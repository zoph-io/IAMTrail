/**
 * Risk assessment for one AWS managed policy document: what it lets a holder do
 * that deserves caution, and how confidently the document alone says so.
 *
 * Everything here reads the policy JSON only. It cannot see trust policies,
 * permissions boundaries, SCPs or which roles exist in an account, so a signal
 * means "this policy grants the actions", never "escalation succeeds". What it
 * can tell apart is a grant on every resource with no condition (unrestricted)
 * from one narrowed by a resource ARN or a Condition (scoped), which is the
 * difference between IAMFullAccess and a service policy that may only pass its
 * own service role.
 *
 * Shared by generate-data.js (the site and the API) and policy-risk.test.js.
 */

const LEVELS = ["critical", "high", "medium"];
const LEVEL_RANK = { critical: 3, high: 2, medium: 1 };
const LEVEL_WEIGHT = { critical: 1000, high: 100, medium: 10 };

/**
 * An IAM action pattern as a regex, matched the way IAM does: case-insensitive,
 * `*` for any run of characters and `?` for one. Kept identical to the one in
 * generate-data.js and lib/iamActionPattern.ts.
 */
function iamPatternRegex(pattern) {
  let body = "";
  for (const ch of pattern) {
    if (ch === "*") body += ".*";
    else if (ch === "?") body += ".";
    else body += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${body}$`, "i");
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function strings(value) {
  return toArray(value)
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim());
}

/** A pattern that matches every action of every service. */
function isEverything(pattern) {
  return pattern === "*" || pattern === "*:*";
}

/**
 * Services whose actions authorize against another service's ARNs, so a resource
 * of that other service still counts as the action's own. sts:AssumeRole targets
 * IAM roles, ssm:SendCommand targets EC2 instances.
 */
const RESOURCE_SERVICE_ALIASES = {
  sts: ["iam"],
  ssm: ["ec2"],
  "ec2-instance-connect": ["ec2"],
  "ssm-guiconnect": ["ec2"],
};

/**
 * Whether one Resource entry covers every resource the action could target.
 *
 * `*`, `arn:aws:iam::*:role/*` and `arn:aws:secretsmanager:*:*:secret:*` all do:
 * a wildcard straight after the resource type leaves nothing out. A path or a
 * name prefix (`role/service-role/*`, `role/AmazonSageMaker*`) narrows it. S3
 * ARNs have no resource type, so there only a wildcard bucket covers them all.
 */
function resourceCoversAll(resource, service) {
  if (resource === "*") return true;
  const parts = resource.split(":");
  if (parts[0] !== "arn" || parts.length < 6) return false;
  const arnService = parts[2].toLowerCase();
  const allowed = [service, ...(RESOURCE_SERVICE_ALIASES[service] || [])];
  if (arnService !== "*" && !allowed.includes(arnService)) return false;
  const rest = parts.slice(5).join(":");
  if (arnService === "s3" || arnService === "s3express") {
    return rest === "*" || rest === "*/*";
  }
  return /^(\*|[\w.-]*[/:]\*)(\/\*)?$/.test(rest);
}

function conditionKeys(condition) {
  if (!condition || typeof condition !== "object") return [];
  const keys = new Set();
  for (const block of Object.values(condition)) {
    if (block && typeof block === "object") {
      for (const key of Object.keys(block)) keys.add(key);
    }
  }
  return [...keys].sort();
}

/** The statements of a policy document, parsed once. */
function parseStatements(document) {
  const out = [];
  for (const [index, stmt] of toArray(document?.Statement).entries()) {
    if (!stmt || typeof stmt !== "object") continue;
    const actions = strings(stmt.Action);
    const notActions = stmt.NotAction !== undefined ? strings(stmt.NotAction) : null;
    out.push({
      index,
      sid: typeof stmt.Sid === "string" ? stmt.Sid : "",
      effect: stmt.Effect === "Deny" ? "Deny" : "Allow",
      actions: actions.map((a) => ({ text: a, re: iamPatternRegex(a) })),
      notActions: notActions && notActions.map((a) => ({ text: a, re: iamPatternRegex(a) })),
      resources: strings(stmt.Resource),
      notResource: stmt.NotResource !== undefined,
      conditions: conditionKeys(stmt.Condition),
    });
  }
  return out;
}

/** The action element of a statement that matches the permission, if any. */
function matchingElement(stmt, permission) {
  if (stmt.notActions) {
    if (stmt.notActions.some((a) => a.re.test(permission))) return null;
    return `NotAction ${stmt.notActions.map((a) => a.text).join(", ")}`;
  }
  const hit = stmt.actions.find((a) => a.re.test(permission));
  return hit ? hit.text : null;
}

function statementUnrestricted(stmt, service) {
  if (stmt.conditions.length > 0) return false;
  if (stmt.notResource) return true;
  return stmt.resources.some((r) => resourceCoversAll(r, service));
}

/**
 * How the policy grants one permission: null when it does not, otherwise the
 * most permissive Allow that matches. An unconditional Deny on every resource
 * cancels it, since that is what IAM does within one policy.
 */
function grantFor(statements, permission) {
  const service = permission.split(":")[0].toLowerCase();
  let best = null;
  for (const stmt of statements) {
    const via = matchingElement(stmt, permission);
    if (!via) continue;
    const unrestricted = statementUnrestricted(stmt, service);
    if (stmt.effect === "Deny") {
      // A NotResource Deny leaves the resources it names allowed, so only an
      // explicit every-resource Deny cancels the grant.
      if (unrestricted && !stmt.notResource) return null;
      continue;
    }
    if (!best || (unrestricted && !best.unrestricted)) {
      best = {
        permission,
        via,
        sid: stmt.sid,
        unrestricted,
        conditions: stmt.conditions,
        resources: stmt.notResource ? ["NotResource"] : stmt.resources.slice(0, 3),
      };
    }
  }
  return best;
}

/**
 * Curated action lists. Each one names a capability a security reviewer asks
 * about by name; the reason is shown next to the signal.
 */
const SECRET_ACTIONS = {
  "secretsmanager:GetSecretValue": "Secrets Manager secret values",
  "secretsmanager:BatchGetSecretValue": "Secrets Manager secret values in bulk",
  "ssm:GetParameter": "Parameter Store values, SecureString included where the KMS key allows it",
  "ssm:GetParameters": "Parameter Store values, SecureString included where the KMS key allows it",
  "ssm:GetParametersByPath": "Parameter Store values, SecureString included where the KMS key allows it",
  "kms:Decrypt": "data encrypted with any KMS key whose key policy allows it",
  "lambda:GetFunctionConfiguration": "Lambda environment variables, where credentials often live",
  "glue:GetConnection": "Glue connection passwords",
};
const STRONG_SECRET_SERVICES = new Set(["secretsmanager", "ssm", "kms"]);

const DATA_ACTIONS = {
  "s3:GetObject": "any object in any S3 bucket",
  "dynamodb:Scan": "any DynamoDB table",
  "dynamodb:GetItem": "any DynamoDB table",
  "rds-data:ExecuteStatement": "any Aurora database through the Data API",
};

const MONITORING_ACTIONS = {
  "cloudtrail:StopLogging": "stop a CloudTrail trail",
  "cloudtrail:DeleteTrail": "delete a CloudTrail trail",
  "cloudtrail:UpdateTrail": "redirect or narrow a CloudTrail trail",
  "cloudtrail:PutEventSelectors": "change which events CloudTrail records",
  "guardduty:DeleteDetector": "delete GuardDuty",
  "guardduty:UpdateDetector": "suspend GuardDuty",
  "securityhub:DisableSecurityHub": "disable Security Hub",
  "config:StopConfigurationRecorder": "stop AWS Config recording",
  "config:DeleteConfigurationRecorder": "delete the AWS Config recorder",
  "access-analyzer:DeleteAnalyzer": "delete an IAM Access Analyzer",
  "macie2:DisableMacie": "disable Macie",
  "inspector2:Disable": "disable Inspector",
  "detective:DeleteGraph": "delete a Detective behavior graph",
  "ec2:DeleteFlowLogs": "delete VPC flow logs",
  "logs:DeleteLogGroup": "delete CloudWatch log groups",
};
/** Losing these loses evidence; losing the others blinds detection outright. */
const LOG_ONLY_MONITORING = new Set(["ec2:DeleteFlowLogs", "logs:DeleteLogGroup"]);

/** Services where permissions management means changing who can do what. */
const IDENTITY_SERVICES = new Set([
  "iam",
  "sts",
  "sso",
  "sso-directory",
  "identitystore",
  "organizations",
]);

/**
 * Service-linked roles are created and scoped by AWS itself, so managing them
 * does not change what any person can do.
 */
const LOW_IMPACT_IDENTITY = new Set([
  "iam:createservicelinkedrole",
  "iam:deleteservicelinkedrole",
]);

/**
 * The access-level data files some reads (glue:DescribeEntity) under permissions
 * management. Outside identity services, only the calls that write a policy, a
 * grant or a share change who can reach a resource.
 */
const SHARING_VERB =
  /^(put|set|update|create|delete|add|remove|attach|detach|modify|replace|revoke|accept|associate|disassociate|enable|disable|share|assume)\w*(policy|policies|permission|grant|acl|share|sharing|access|trust)/i;

/** How pathfinding.cloud categories read to someone deciding whether to attach a policy. */
const PATH_CATEGORIES = {
  "self-escalation": {
    signal: "self-escalation",
    title: "Can grant itself more permissions",
    unrestricted: "critical",
  },
  "principal-access": {
    signal: "principal-access",
    title: "Can take over other users or roles",
    unrestricted: "critical",
  },
  "new-passrole": {
    signal: "new-passrole",
    title: "Can launch resources that run as a more privileged role",
    unrestricted: "high",
  },
  "existing-passrole": {
    signal: "existing-passrole",
    title: "Can take over existing resources that run as another role",
    unrestricted: "high",
  },
};

const MAX_LISTED = 12;

function listFirst(items) {
  return items.length > MAX_LISTED
    ? { items: items.slice(0, MAX_LISTED), more: items.length - MAX_LISTED }
    : { items, more: 0 };
}

function plural(count, singular, pluralForm) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

/**
 * @param {object} options
 * @param {object[]} options.paths pathfinding.cloud catalog entries with permissions.required
 * @param {Iterable<string>} options.permissionsManagement lowercase action names, from iam-metadata.json
 */
function createRiskEngine({ paths, permissionsManagement }) {
  const catalog = paths
    .filter((p) => p && p.id && Array.isArray(p.permissions?.required) && p.permissions.required.length)
    .map((p) => ({
      id: p.id,
      name: p.name || p.id,
      category: p.category || "unknown",
      required: p.permissions.required
        .map((e) => (typeof e === "string" ? e : e && e.permission))
        .filter((perm) => typeof perm === "string" && perm.includes(":")),
    }))
    .filter((p) => p.required.length > 0);
  const pmActions = [...permissionsManagement].filter((a) => a.includes(":"));

  /**
   * @param {object} document the policy's Document
   * @param {object} [extras]
   * @param {{issueCode: string, findingDetails: string}[]} [extras.securityWarnings]
   *   Access Analyzer SECURITY_WARNING findings for this policy
   */
  function assess(document, extras = {}) {
    const statements = parseStatements(document);
    const allows = statements.filter((s) => s.effect === "Allow");
    const signals = [];
    const cache = new Map();
    const grant = (permission) => {
      const key = permission.toLowerCase();
      if (!cache.has(key)) cache.set(key, grantFor(statements, permission));
      return cache.get(key);
    };

    // Full access, stated outright or as "everything except". An outright grant
    // wins over NotAction, and an unrestricted one over a scoped one.
    const rankAdmin = (c) => (c.except ? 0 : 2) + (c.unrestricted ? 1 : 0);
    let admin = null;
    for (const stmt of allows) {
      const unrestricted = statementUnrestricted(stmt, "*");
      let candidate = null;
      if (stmt.actions.some((a) => isEverything(a.text))) {
        candidate = { stmt, unrestricted, except: null };
      } else if (stmt.notActions) {
        candidate = { stmt, unrestricted, except: stmt.notActions.map((a) => a.text) };
      }
      if (candidate && (!admin || rankAdmin(candidate) > rankAdmin(admin))) admin = candidate;
    }
    const denied = statements
      .filter((s) => s.effect === "Deny" && s.conditions.length === 0)
      .flatMap((s) => s.actions.map((a) => a.text));

    const matchedPaths = [];
    for (const p of catalog) {
      const grants = p.required.map(grant);
      if (grants.some((g) => !g)) continue;
      matchedPaths.push({
        id: p.id,
        name: p.name,
        category: p.category,
        unrestricted: grants.every((g) => g.unrestricted),
        grants: grants.map((g) => ({
          permission: g.permission,
          via: g.via,
          unrestricted: g.unrestricted,
          conditions: g.conditions,
          resources: g.resources,
        })),
      });
    }

    const fullAdmin = admin && !admin.except;
    if (admin) {
      const cond = admin.stmt.conditions;
      if (!admin.except) {
        const exceptions = denied.length ? `, except what its Deny statements exclude (${denied.slice(0, 5).join(", ")})` : "";
        signals.push({
          id: "admin",
          severity: admin.unrestricted ? "critical" : "high",
          title: admin.unrestricted
            ? "Full administrator access"
            : "Full access to every action, under a condition",
          summary: admin.unrestricted
            ? `Allows every action on every resource${exceptions}. It covers all ${plural(matchedPaths.length, "documented privilege escalation path")} by definition.`
            : `Allows every action, limited only by ${cond.length ? `the condition ${cond.join(", ")}` : "the resources it names"}. Whether that is safe depends entirely on that limit.`,
          evidence: [
            `${admin.stmt.sid || `Statement ${admin.stmt.index + 1}`}: Action "${admin.stmt.actions.find((a) => isEverything(a.text)).text}" on ${admin.stmt.resources.join(", ") || "NotResource"}`,
          ],
          conditions: cond,
        });
      } else {
        const services = admin.except.map((a) => a.replace(/:\*$/, "")).slice(0, 8);
        signals.push({
          id: "admin",
          severity: admin.unrestricted ? "critical" : "high",
          title: "Near-administrator access",
          summary: `Allows every action except ${admin.except.length > 8 ? `${services.join(", ")} and ${admin.except.length - 8} more` : services.join(", ")}${admin.unrestricted ? " on every resource" : `, limited by ${cond.join(", ") || "the resources it names"}`}. Whatever it can reach, it can change, read or delete.`,
          evidence: [
            `${admin.stmt.sid || `Statement ${admin.stmt.index + 1}`}: NotAction ${admin.except.join(", ")}`,
          ],
          conditions: cond,
        });
      }
    }

    // Full administrator access already says everything below; listing all 92
    // paths and 500 permissions under AdministratorAccess only buries the point.
    if (!fullAdmin) {
      const byCategory = new Map();
      for (const p of matchedPaths) {
        if (!byCategory.has(p.category)) byCategory.set(p.category, []);
        byCategory.get(p.category).push(p);
      }
      for (const [category, list] of byCategory) {
        const meta = PATH_CATEGORIES[category] || {
          signal: category,
          title: `Documented privilege escalation (${category})`,
          unrestricted: "high",
        };
        const open = list.filter((p) => p.unrestricted);
        // A path made only of sts: actions, sts:AssumeRole on its own, works only
        // where a role's trust policy already lets the holder in. It cannot create
        // that trust, so it stops at high.
        const pathSeverity = (p) =>
          !p.unrestricted
            ? "medium"
            : p.grants.every((g) => g.permission.toLowerCase().startsWith("sts:"))
              ? "high"
              : meta.unrestricted;
        const severity = list.map(pathSeverity).sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a])[0];
        signals.push({
          id: meta.signal,
          severity,
          title: meta.title,
          summary: open.length
            ? `Grants every action of ${plural(open.length, "documented escalation path")} on any resource with no condition${list.length > open.length ? `, and ${list.length - open.length} more in a scoped form` : ""}.`
            : `Grants the actions of ${plural(list.length, "documented escalation path")}, but only on named resources or under a condition. Review that scope before trusting it.`,
          paths: list
            .sort((a, b) => Number(b.unrestricted) - Number(a.unrestricted) || a.id.localeCompare(b.id))
            .map((p) => ({ id: p.id, name: p.name, unrestricted: p.unrestricted, grants: p.grants })),
        });
      }

      const pmOpen = [];
      for (const action of pmActions) {
        const g = grant(action);
        if (g && g.unrestricted) pmOpen.push(action);
      }
      const identity = pmOpen.filter(
        (a) => IDENTITY_SERVICES.has(a.split(":")[0]) && !LOW_IMPACT_IDENTITY.has(a)
      );
      const sharing = pmOpen.filter(
        (a) => !IDENTITY_SERVICES.has(a.split(":")[0]) && SHARING_VERB.test(a.split(":")[1])
      );
      if (identity.length) {
        const shown = listFirst(identity);
        signals.push({
          id: "identity-admin",
          severity: "high",
          title: "Can change identities and their permissions",
          summary: `Grants ${plural(identity.length, "permissions management action")} on IAM, IAM Identity Center or Organizations, on any resource with no condition.`,
          actions: shown.items,
          moreActions: shown.more,
        });
      }
      if (sharing.length) {
        const shown = listFirst(sharing);
        const services = [...new Set(sharing.map((a) => a.split(":")[0]))];
        signals.push({
          id: "resource-sharing",
          severity: "medium",
          title: "Can rewrite resource policies and sharing",
          summary: `Grants ${plural(sharing.length, "permissions management action")} across ${plural(services.length, "service")} (${services.slice(0, 6).join(", ")}${services.length > 6 ? ", ..." : ""}) on any resource, enough to share resources outside the account.`,
          actions: shown.items,
          moreActions: shown.more,
        });
      }

      const secrets = Object.keys(SECRET_ACTIONS).filter((a) => grant(a)?.unrestricted);
      if (secrets.length) {
        const strong = secrets.some((a) => STRONG_SECRET_SERVICES.has(a.split(":")[0]));
        signals.push({
          id: "secrets",
          severity: strong ? "high" : "medium",
          title: "Can read secrets",
          summary: `Reads ${[...new Set(secrets.map((a) => SECRET_ACTIONS[a]))].join("; ")}, on any resource with no condition.`,
          actions: secrets.map((a) => grant(a).via === a ? a : `${a} (via ${grant(a).via})`),
          moreActions: 0,
        });
      }

      const data = Object.keys(DATA_ACTIONS).filter((a) => grant(a)?.unrestricted);
      if (data.length) {
        signals.push({
          id: "data-read",
          severity: "medium",
          title: "Can read data in every bucket or table",
          summary: `Reads ${[...new Set(data.map((a) => DATA_ACTIONS[a]))].join("; ")}. Read-only is not the same as harmless when the data is the asset.`,
          actions: data.map((a) => grant(a).via === a ? a : `${a} (via ${grant(a).via})`),
          moreActions: 0,
        });
      }

      const monitoring = Object.keys(MONITORING_ACTIONS).filter((a) => grant(a)?.unrestricted);
      if (monitoring.length) {
        signals.push({
          id: "monitoring",
          severity: monitoring.every((a) => LOG_ONLY_MONITORING.has(a)) ? "medium" : "high",
          title: "Can switch off security monitoring",
          summary: `Can ${monitoring.map((a) => MONITORING_ACTIONS[a]).join(", ")}, which is how an intruder hides.`,
          actions: monitoring.map((a) => grant(a).via === a ? a : `${a} (via ${grant(a).via})`),
          moreActions: 0,
        });
      }

      const serviceWide = new Set();
      for (const stmt of allows) {
        if (stmt.conditions.length) continue;
        for (const a of stmt.actions) {
          const m = /^([\w-]+):\*$/.exec(a.text);
          if (m && statementUnrestricted(stmt, m[1].toLowerCase())) serviceWide.add(m[1].toLowerCase());
        }
      }
      if (serviceWide.size) {
        const list = [...serviceWide].sort();
        signals.push({
          id: "service-wildcard",
          severity: "medium",
          title: list.length === 1 ? `Full ${list[0]} access on every resource` : `Full access to ${list.length} services on every resource`,
          summary: `Uses ${list.slice(0, 8).map((s) => `${s}:*`).join(", ")}${list.length > 8 ? ` and ${list.length - 8} more` : ""} with Resource "*" and no condition, so every action AWS adds to ${list.length === 1 ? "that service" : "those services"} later is granted too.`,
          actions: list.map((s) => `${s}:*`),
          moreActions: 0,
        });
      }
    }

    const warnings = extras.securityWarnings || [];
    if (warnings.length) {
      const codes = [...new Set(warnings.map((w) => w.issueCode))];
      signals.push({
        id: "access-analyzer",
        severity: "medium",
        title: "Flagged by AWS IAM Access Analyzer",
        summary: `AWS's own policy validation raises ${plural(warnings.length, "security warning")}: ${codes.join(", ")}.`,
        evidence: warnings.slice(0, 5).map((w) => w.findingDetails),
      });
    }

    signals.sort(
      (a, b) => LEVEL_RANK[b.severity] - LEVEL_RANK[a.severity] || SIGNAL_ORDER.indexOf(a.id) - SIGNAL_ORDER.indexOf(b.id)
    );
    const level = signals.length ? signals[0].severity : null;
    const openPaths = matchedPaths.filter((p) => p.unrestricted).length;
    const score = signals.length
      ? LEVEL_WEIGHT[level] +
        signals.reduce((sum, s) => sum + LEVEL_WEIGHT[s.severity] / 10, 0) +
        openPaths * 2 +
        (matchedPaths.length - openPaths)
      : 0;

    return {
      level,
      score: Math.round(score),
      signals,
      pathIds: matchedPaths.map((p) => p.id),
      openPathIds: matchedPaths.filter((p) => p.unrestricted).map((p) => p.id),
    };
  }

  return { assess, pathsInCatalog: catalog.length };
}

const SIGNAL_ORDER = [
  "admin",
  "self-escalation",
  "principal-access",
  "identity-admin",
  "new-passrole",
  "existing-passrole",
  "monitoring",
  "secrets",
  "resource-sharing",
  "data-read",
  "service-wildcard",
  "access-analyzer",
];

/**
 * What changed between two assessments of the same policy, for the risk
 * timeline. Null when nothing a reader would care about moved.
 */
function diffAssessments(before, after) {
  const beforeIds = new Map((before?.signals || []).map((s) => [s.id, s.severity]));
  const afterIds = new Map((after?.signals || []).map((s) => [s.id, s.severity]));
  const added = [];
  const removed = [];
  for (const s of after?.signals || []) {
    const was = beforeIds.get(s.id);
    if (!was || LEVEL_RANK[s.severity] > LEVEL_RANK[was]) added.push({ id: s.id, title: s.title, severity: s.severity });
  }
  for (const s of before?.signals || []) {
    const now = afterIds.get(s.id);
    if (!now || LEVEL_RANK[now] < LEVEL_RANK[s.severity]) removed.push({ id: s.id, title: s.title, severity: s.severity });
  }
  const beforePaths = new Set(before?.openPathIds || []);
  const afterPaths = new Set(after?.openPathIds || []);
  const pathsAdded = [...afterPaths].filter((p) => !beforePaths.has(p));
  const pathsRemoved = [...beforePaths].filter((p) => !afterPaths.has(p));
  const from = before?.level || null;
  const to = after?.level || null;
  if (from === to && !added.length && !removed.length && !pathsAdded.length && !pathsRemoved.length) {
    return null;
  }
  const direction =
    (LEVEL_RANK[to] || 0) > (LEVEL_RANK[from] || 0) || (from === to && (added.length || pathsAdded.length) && !removed.length)
      ? "riskier"
      : (LEVEL_RANK[to] || 0) < (LEVEL_RANK[from] || 0) || (from === to && (removed.length || pathsRemoved.length) && !added.length)
        ? "safer"
        : "changed";
  return { from, to, direction, added, removed, pathsAdded, pathsRemoved };
}

module.exports = {
  LEVELS,
  LEVEL_RANK,
  SIGNAL_ORDER,
  createRiskEngine,
  diffAssessments,
  resourceCoversAll,
  parseStatements,
  grantFor,
};
