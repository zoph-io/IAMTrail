/**
 * Types and wording for the policy risk assessment written by
 * scripts/policy-risk.js into public/data/findings.json and into each policy's
 * securitySignals. Signal titles and summaries arrive pre-rendered; what lives
 * here is what the page says around them: a short label, what the signal means
 * and how to use a policy that carries it.
 */

export type RiskLevel = "critical" | "high" | "medium";

export type RiskGrant = {
  permission: string;
  via: string;
  unrestricted: boolean;
  conditions: string[];
  resources: string[];
};

export type RiskPath = {
  id: string;
  name: string;
  unrestricted: boolean;
  grants?: RiskGrant[];
};

export type RiskSignal = {
  id: string;
  severity: RiskLevel;
  title: string;
  summary: string;
  evidence?: string[];
  conditions?: string[];
  paths?: RiskPath[];
  actions?: string[];
  moreActions?: number;
};

export type PolicyRisk = { level: RiskLevel; signals: RiskSignal[] };

export type RiskListEntry = {
  name: string;
  level: RiskLevel;
  score: number;
  headline: string;
  reason: string;
  signals: { id: string; severity: RiskLevel; title: string }[];
  paths: number;
  openPaths: number;
  lastModified: string;
};

export type RiskChange = {
  policy: string;
  date: string;
  hash: string;
  kind: "new" | "change";
  from: RiskLevel | null;
  to: RiskLevel | null;
  direction: "riskier" | "safer" | "changed";
  added: { id: string; title: string; severity: RiskLevel }[];
  removed: { id: string; title: string; severity: RiskLevel }[];
  pathsAdded: string[];
  pathsRemoved: string[];
};

export type AccessAnalyzerFinding = {
  source: "access_analyzer";
  findingType: "ERROR" | "SECURITY_WARNING" | "WARNING" | "SUGGESTION";
  findingDetails: string;
  issueCode: string;
  learnMoreLink: string;
};

export type FindingsFile = {
  lastUpdated: string;
  generatedAt: string;
  totalPoliciesAnalyzed: number;
  risk: {
    counts: Record<RiskLevel, number>;
    signalCounts: Record<string, number>;
    escalationAny: number;
    escalationOpen: number;
    policies: RiskListEntry[];
    changesWindowDays: number;
    changes: RiskChange[];
  };
  pathfinding: {
    attribution: string;
    catalogLastUpdated: string | null;
    pathsInCatalog: number;
  };
  accessAnalyzer: {
    policiesWithFindings: number;
    totalFindingRows: number;
    byType: Record<string, number>;
    policies: { name: string; findings: AccessAnalyzerFinding[] }[];
  };
};

export const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium"];

export const LEVEL_RANK_UI: Record<RiskLevel, number> = { critical: 3, high: 2, medium: 1 };

export const LEVEL_META: Record<
  RiskLevel,
  { label: string; meaning: string; badge: string; accent: string }
> = {
  critical: {
    label: "Critical",
    meaning:
      "Administrator access, or an unrestricted way to grant itself permissions or take over other identities. Treat it as admin.",
    badge:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    accent: "border-l-red-600",
  },
  high: {
    label: "High",
    meaning:
      "An unrestricted escalation path, identity administration, secret reads or the power to switch off security monitoring.",
    badge:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900",
    accent: "border-l-orange-500",
  },
  medium: {
    label: "Medium",
    meaning:
      "The same capabilities in a scoped form, resource policy writes, reads across all data, or full access to a whole service.",
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    accent: "border-l-amber-400",
  },
};

export const SIGNAL_META: Record<
  string,
  { label: string; meaning: string; guidance: string }
> = {
  admin: {
    label: "Admin",
    meaning:
      "Allows every action (Action \"*\"), or every action outside a short NotAction list, on every resource.",
    guidance:
      "Keep it for administrator or break-glass roles protected by MFA. Never attach it to a workload, a CI pipeline or a vendor role.",
  },
  "self-escalation": {
    label: "Self-escalation",
    meaning:
      "Can rewrite or attach IAM policies, so whoever holds it can make itself administrator.",
    guidance:
      "Treat it as administrator access. If it must be used, add a permissions boundary that denies IAM policy writes on your own roles and users.",
  },
  "principal-access": {
    label: "Identity takeover",
    meaning:
      "Can create access keys or console passwords for other users, rewrite role trust policies, or assume roles.",
    guidance:
      "Reserve it for identity administrators. Keep role trust policies narrow, since sts:AssumeRole on every role is only as safe as the roles that trust the account.",
  },
  "new-passrole": {
    label: "PassRole, new resources",
    meaning:
      "Can pass a role to a service and launch something (a function, an instance, a job) that runs with that role's permissions.",
    guidance:
      "Make sure no highly privileged role trusts the service involved, and restrict iam:PassRole in your own policies or boundary to named roles with iam:PassedToService.",
  },
  "existing-passrole": {
    label: "PassRole, existing resources",
    meaning:
      "Can change the code or commands of something that already runs as a role, and so act as that role.",
    guidance:
      "List the roles attached to the functions, instances, pipelines or notebooks it can modify: the holder effectively has them too.",
  },
  "identity-admin": {
    label: "Identity admin",
    meaning:
      "Grants permissions management actions on IAM, IAM Identity Center or Organizations, on every resource.",
    guidance:
      "Grant it only to identity administrators, and protect your admin roles and SCPs with a permissions boundary or an SCP of their own.",
  },
  monitoring: {
    label: "Disables monitoring",
    meaning:
      "Can stop CloudTrail, GuardDuty, Config, Security Hub or other detection, or delete the logs they write.",
    guidance:
      "Deny these actions with an SCP for everyone outside a break-glass role, so no single policy can blind you.",
  },
  secrets: {
    label: "Reads secrets",
    meaning:
      "Can read Secrets Manager secrets, Parameter Store values, KMS-encrypted data, Lambda environment variables or Glue connection passwords on every resource.",
    guidance:
      "Where the holder needs only some secrets, write your own policy scoped to their ARNs or tags, and limit decryption in the KMS key policies.",
  },
  "resource-sharing": {
    label: "Resource policies",
    meaning:
      "Can write resource policies, grants or shares, which is enough to open a resource to another account or the public.",
    guidance:
      "Turn on IAM Access Analyzer external access findings, and keep account-level guards like S3 Block Public Access enabled.",
  },
  "data-read": {
    label: "Reads all data",
    meaning:
      "Can read every S3 object, every DynamoDB table or every Aurora database through the Data API.",
    guidance:
      "Read access to data is still access to data. For people who only need to see configuration, ViewOnlyAccess carries none of these signals.",
  },
  "service-wildcard": {
    label: "Service wildcard",
    meaning:
      "Uses service:* on every resource with no condition, so each action AWS adds to that service later is granted too.",
    guidance:
      "The grant grows every time the service does. For long-lived access, prefer a policy that lists the actions you actually need.",
  },
  "access-analyzer": {
    label: "Access Analyzer",
    meaning:
      "AWS IAM Access Analyzer's own policy validation raises a security warning, like iam:PassRole on every resource.",
    guidance: "Read AWS's finding and the documentation it links to.",
  },
};

const SCOPED_PATH_GUIDANCE =
  "Check which roles, users or policies fall inside the scope shown above. Within it the escalation works as documented, so keep privileged principals out of it.";

export function signalGuidance(signal: RiskSignal): string {
  if (signal.paths?.length && signal.paths.every((p) => !p.unrestricted)) {
    return SCOPED_PATH_GUIDANCE;
  }
  return SIGNAL_META[signal.id]?.guidance ?? "";
}

export function signalLabel(id: string): string {
  return SIGNAL_META[id]?.label ?? id;
}

export function pathfindingUrl(pathId: string): string {
  return `https://pathfinding.cloud/paths/${encodeURIComponent(pathId)}`;
}
