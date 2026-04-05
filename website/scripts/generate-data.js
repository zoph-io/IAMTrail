const fs = require("fs");
const path = require("path");
const https = require("https");
const { simpleGit } = require("simple-git");
const yaml = require("js-yaml");

const REPO_ROOT = path.join(__dirname, "../..");
const POLICIES_DIR = path.join(REPO_ROOT, "policies");
const FINDINGS_DIR = path.join(REPO_ROOT, "findings");
const OUTPUT_DIR = path.join(__dirname, "../public/data");
const PUBLIC_DIR = path.join(__dirname, "../public");
const FEEDS_DIR = path.join(PUBLIC_DIR, "feeds");
const SITE_URL = "https://iamtrail.com";
const GITHUB_REPO = "https://github.com/zoph-io/IAMTrail";
const git = simpleGit(REPO_ROOT);

/** Map legacy git author names to IAMTrail for UI and exports. */
function displayAuthorName(name) {
  if (!name || typeof name !== "string") return name;
  const t = name.trim();
  if (/^mamip\s*bot$/i.test(t)) return "IAMTrail";
  if (/mamip-github-actions/i.test(t)) return "IAMTrail";
  return name;
}

function iamActionToSlug(action) {
  return Buffer.from(action, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve, reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function generatePolicyData() {
  console.log("🔍 Scanning policies directory...");

  // Read all policy files
  const policyFiles = fs
    .readdirSync(POLICIES_DIR)
    .filter((file) => !file.startsWith(".") && file !== "README.md");

  console.log(`📊 Found ${policyFiles.length} policies`);

  const policies = [];
  const errors = [];
  const allCommitEntries = [];
  const uniqueLiteralActions = new Set();
  const actionBuckets = new Map();
  const policiesWithWildcard = new Set();
  const wildcardPoliciesByService = {};

  function actionBucket(action) {
    if (!actionBuckets.has(action)) {
      actionBuckets.set(action, {
        actionAllow: new Set(),
        actionDeny: new Set(),
        notAction: new Set(),
      });
    }
    return actionBuckets.get(action);
  }

  function noteWildcardPolicy(policyName, actionStr) {
    policiesWithWildcard.add(policyName);
    const colon = actionStr.indexOf(":");
    const prefix =
      colon > 0 ? actionStr.slice(0, colon).toLowerCase() : "";
    if (prefix && prefix !== "*") {
      if (!wildcardPoliciesByService[prefix]) {
        wildcardPoliciesByService[prefix] = new Set();
      }
      wildcardPoliciesByService[prefix].add(policyName);
    }
  }

  for (const policyName of policyFiles) {
    try {
      const policyPath = path.join(POLICIES_DIR, policyName);
      const relativePath = `policies/${policyName}`;

      // Read policy content
      const content = fs.readFileSync(policyPath, "utf8");
      let policyData;
      try {
        policyData = JSON.parse(content);
      } catch (e) {
        console.warn(`⚠️  Could not parse JSON for ${policyName}, skipping`);
        continue;
      }

      // Get git history (without --follow to avoid false rename/copy detection)
      const rawLog = await git.raw([
        "log",
        "--max-count=100",
        "--format=%H|%aI|%s|%an",
        "--",
        relativePath,
      ]);
      const logEntries = (rawLog || "")
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          const [hash, date, message, author_name] = line.split("|");
          return { hash, date, message, author_name };
        });

      for (const entry of logEntries) {
        allCommitEntries.push({
          date: entry.date,
          message: entry.message,
          hash: entry.hash,
          policyName,
        });
      }

      // Get file stats
      const stats = fs.statSync(policyPath);

      // Count actions and extract service prefixes from IAM actions
      let actionCount = 0;
      const servicePrefixes = new Set();
      try {
        const statements =
          policyData.PolicyVersion?.Document?.Statement || [];
        const stmtArray = Array.isArray(statements)
          ? statements
          : [statements];
        for (const stmt of stmtArray) {
          const effect = stmt.Effect === "Deny" ? "Deny" : "Allow";

          if (stmt.Action) {
            const raw = stmt.Action;
            const actionArray = Array.isArray(raw) ? raw : [raw];
            actionCount += actionArray.length;
            for (const action of actionArray) {
              if (typeof action !== "string") continue;
              const prefix = action.split(":")[0];
              if (prefix && prefix !== "*") {
                servicePrefixes.add(prefix.toLowerCase());
              }
              if (action.includes("*")) {
                noteWildcardPolicy(policyName, action);
                continue;
              }
              uniqueLiteralActions.add(action);
              const b = actionBucket(action);
              if (effect === "Deny") b.actionDeny.add(policyName);
              else b.actionAllow.add(policyName);
            }
          }

          if (stmt.NotAction) {
            const raw = stmt.NotAction;
            const actionArray = Array.isArray(raw) ? raw : [raw];
            actionCount += actionArray.length;
            for (const action of actionArray) {
              if (typeof action !== "string") continue;
              const prefix = action.split(":")[0];
              if (prefix && prefix !== "*") {
                servicePrefixes.add(prefix.toLowerCase());
              }
              if (action.includes("*")) {
                noteWildcardPolicy(policyName, action);
                continue;
              }
              uniqueLiteralActions.add(action);
              actionBucket(action).notAction.add(policyName);
            }
          }
        }
      } catch (e) {
        // skip action parsing errors
      }

      const firstSeenDate =
        logEntries.length > 0
          ? logEntries[logEntries.length - 1].date
          : stats.mtime.toISOString();

      const policy = {
        name: policyName,
        createDate: policyData.PolicyVersion?.CreateDate || null,
        versionId: policyData.PolicyVersion?.VersionId || null,
        lastModified: logEntries.length > 0
          ? logEntries[0].date
          : stats.mtime.toISOString(),
        versionsCount: logEntries.length,
        size: stats.size,
        actionCount,
        servicePrefixes: [...servicePrefixes],
        firstSeen: firstSeenDate,
        history: logEntries.slice(0, 10).map((entry) => ({
          hash: entry.hash,
          date: entry.date,
          message: entry.message,
          author: displayAuthorName(entry.author_name),
        })),
      };

      policies.push(policy);

      // Save individual policy with full content
      const policyDetail = {
        ...policy,
        content: policyData,
      };

      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${policyName}.json`),
        JSON.stringify(policyDetail, null, 2)
      );
    } catch (error) {
      errors.push({ policyName, error: error.message });
      console.error(`❌ Error processing ${policyName}:`, error.message);
    }
  }

  // Sort and calculate stats
  policies.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  // Find brand new policies (v1 version = new AWS service/feature)
  const brandNewPolicies = [...policies]
    .filter((p) => p.versionId === "v1")
    .sort(
      (a, b) =>
        new Date(b.createDate || b.lastModified) -
        new Date(a.createDate || a.lastModified)
    )
    .slice(0, 20);

  const wildcardPoliciesByServiceCounts = {};
  for (const [svc, set] of Object.entries(wildcardPoliciesByService)) {
    wildcardPoliciesByServiceCounts[svc] = set.size;
  }

  const stats = {
    totalPolicies: policies.length,
    uniqueLiteralActionCount: uniqueLiteralActions.size,
    policiesWithWildcardActions: policiesWithWildcard.size,
    wildcardPoliciesByService: wildcardPoliciesByServiceCounts,
    lastUpdate: new Date().toISOString(),
    mostModified: [...policies]
      .sort((a, b) => b.versionsCount - a.versionsCount)
      .slice(0, 10),
    recentlyUpdated: policies.slice(0, 10),
    newest: [...policies]
      .filter((p) => p.createDate)
      .sort((a, b) => new Date(b.createDate) - new Date(a.createDate))
      .slice(0, 10),
    oldest: [...policies]
      .sort((a, b) => new Date(a.lastModified) - new Date(b.lastModified))
      .slice(0, 10),
    brandNew: brandNewPolicies,
  };

  // Policies by year (based on first-seen in git)
  const policiesByYear = {};
  for (const p of policies) {
    const year = new Date(p.firstSeen).getFullYear().toString();
    policiesByYear[year] = (policiesByYear[year] || 0) + 1;
  }
  stats.policiesByYear = policiesByYear;

  // Largest policies by action count
  stats.largestByActionCount = [...policies]
    .sort((a, b) => b.actionCount - a.actionCount)
    .slice(0, 20)
    .map((p) => ({ name: p.name, actionCount: p.actionCount }));

  // Service growth: find the earliest year each IAM service prefix appeared
  const serviceFirstSeen = {};
  for (const p of policies) {
    const year = new Date(p.firstSeen).getFullYear();
    for (const svc of p.servicePrefixes) {
      if (!serviceFirstSeen[svc] || year < serviceFirstSeen[svc]) {
        serviceFirstSeen[svc] = year;
      }
    }
  }
  const serviceGrowth = {};
  for (const [svc, year] of Object.entries(serviceFirstSeen)) {
    const yearStr = year.toString();
    if (!serviceGrowth[yearStr]) {
      serviceGrowth[yearStr] = [];
    }
    serviceGrowth[yearStr].push(svc);
  }
  for (const year of Object.keys(serviceGrowth)) {
    serviceGrowth[year].sort();
  }
  stats.serviceGrowth = serviceGrowth;

  // --- New chart data aggregations ---
  // 2019 is always excluded: it's the initial fork/import, not real activity.
  console.log("📈 Computing chart data from git history...");

  // Build a lookup of each policy's first-seen year and date
  const newPoliciesByYear = {};
  const newPoliciesByReinventYear = {};
  for (const p of policies) {
    const d = new Date(p.firstSeen);
    const yr = d.getUTCFullYear();
    if (yr === 2019) continue;
    const yrStr = yr.toString();
    newPoliciesByYear[yrStr] = (newPoliciesByYear[yrStr] || 0) + 1;

    const mo = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if ((mo === 11 && day >= 15) || (mo === 12 && day <= 15)) {
      newPoliciesByReinventYear[yrStr] =
        (newPoliciesByReinventYear[yrStr] || 0) + 1;
    }
  }

  // Filter commit entries to exclude 2019
  const filteredEntries = allCommitEntries.filter(
    (e) => new Date(e.date).getUTCFullYear() !== 2019
  );

  // Exclude bulk-reformat days where detection logic changes (e.g. jq -S
  // key-sorting, invisible character normalization) caused every policy to
  // appear modified. Any day with >= BULK_DAY_THRESHOLD per-policy changes
  // is treated as a false-positive bulk day.
  const BULK_DAY_THRESHOLD = 50;
  const commitsByDate = {};
  for (const e of filteredEntries) {
    const dateKey = new Date(e.date).toISOString().slice(0, 10);
    commitsByDate[dateKey] = (commitsByDate[dateKey] || 0) + 1;
  }
  const bulkDays = new Set(
    Object.entries(commitsByDate)
      .filter(([, count]) => count >= BULK_DAY_THRESHOLD)
      .map(([date]) => date)
  );
  if (bulkDays.size > 0) {
    console.log(
      `   ⚠️  Excluding ${bulkDays.size} bulk-reformat day(s): ${[...bulkDays].join(", ")}`
    );
  }
  const cleanEntries = filteredEntries.filter(
    (e) => !bulkDays.has(new Date(e.date).toISOString().slice(0, 10))
  );
  const cleanDates = cleanEntries.map((e) => new Date(e.date));

  stats.bulkDaysExcluded = [...bulkDays].sort();

  // Monthly seasonality: aggregate commits by calendar month (01-12)
  const changesByMonth = {};
  for (let m = 1; m <= 12; m++) {
    changesByMonth[String(m).padStart(2, "0")] = 0;
  }
  for (const d of cleanDates) {
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    changesByMonth[mo]++;
  }
  stats.changesByMonth = changesByMonth;

  // re:Invent pulse: Nov 15 - Dec 15 window per year
  const reinventByYear = {};
  for (const e of cleanEntries) {
    const d = new Date(e.date);
    const mo = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const yr = d.getUTCFullYear().toString();
    if ((mo === 11 && day >= 15) || (mo === 12 && day <= 15)) {
      reinventByYear[yr] = (reinventByYear[yr] || 0) + 1;
    }
  }
  const reinventYears = Object.keys(reinventByYear).sort();
  stats.reinventPulse = reinventYears.map((yr) => ({
    year: yr,
    changes: reinventByYear[yr] || 0,
    newPolicies: newPoliciesByReinventYear[yr] || 0,
  }));

  // Version distribution: count policies at each current version
  const versionDist = {};
  for (const p of policies) {
    const v = p.versionId || "unknown";
    versionDist[v] = (versionDist[v] || 0) + 1;
  }
  stats.versionDistribution = versionDist;

  // Top version policies (the most-revised outliers)
  stats.topVersionPolicies = [...policies]
    .map((p) => {
      const num = parseInt((p.versionId || "v0").replace("v", ""), 10) || 0;
      return { name: p.name, version: p.versionId || "v0", versionNumber: num };
    })
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .slice(0, 10);

  // Yearly velocity: total commits per year, with new-launches from firstSeen
  const velocityTotalByYear = {};
  for (const e of cleanEntries) {
    const yr = new Date(e.date).getUTCFullYear().toString();
    velocityTotalByYear[yr] = (velocityTotalByYear[yr] || 0) + 1;
  }
  const velYears = Object.keys(velocityTotalByYear).sort();
  stats.yearlyVelocity = velYears.map((yr) => {
    const total = velocityTotalByYear[yr] || 0;
    const np = newPoliciesByYear[yr] || 0;
    return { year: yr, total, newPolicies: np, updates: total - np };
  });

  // Most volatile this year (trailing 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentChanges = {};
  for (const p of policies) {
    let count = 0;
    for (const h of p.history) {
      if (new Date(h.date) >= oneYearAgo) count++;
    }
    if (count > 1) recentChanges[p.name] = count;
  }
  stats.volatileThisYear = Object.entries(recentChanges)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, changesThisYear]) => ({ name, changesThisYear }));

  console.log(
    `   📈 Chart data: ${cleanEntries.length} commit entries (excl. 2019 + ${bulkDays.size} bulk day(s)), ` +
      `${reinventYears.length} re:Invent years, ` +
      `${stats.volatileThisYear.length} volatile policies`
  );

  // Read deprecated policies
  const deprecatedPath = path.join(REPO_ROOT, "DEPRECATED.json");
  let deprecated = {};
  if (fs.existsSync(deprecatedPath)) {
    deprecated = JSON.parse(fs.readFileSync(deprecatedPath, "utf8"));
  }

  // IAM action inverse index (literal strings only; wildcards excluded from keys)
  const actionsOut = {};
  for (const action of [...uniqueLiteralActions].sort()) {
    const b = actionBucket(action);
    actionsOut[action] = {
      actionAllowPolicies: [...b.actionAllow].sort(),
      actionDenyPolicies: [...b.actionDeny].sort(),
      notActionPolicies: [...b.notAction].sort(),
    };
  }
  const actionIndexPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    stats: {
      uniqueLiteralActionCount: uniqueLiteralActions.size,
      policiesWithWildcardActions: policiesWithWildcard.size,
      wildcardPoliciesByService: wildcardPoliciesByServiceCounts,
    },
    effectiveGrantPreview: null,
    actions: actionsOut,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "action-index.json"),
    JSON.stringify(actionIndexPayload)
  );
  console.log(
    `   🔑 Action index: ${uniqueLiteralActions.size} literal actions, ${policiesWithWildcard.size} policies with wildcards`
  );

  // SAR-style action definitions (iam-dataset by Ian McKay) intersected with our action keys
  const IAM_DEFINITION_URL =
    "https://raw.githubusercontent.com/iann0036/iam-dataset/main/aws/iam_definition.json";
  const LIST_CAP = 30;
  const attributionText =
    "Action descriptions and access metadata from iam-dataset (Ian McKay, github.com/iann0036/iam-dataset), MIT license. Derived from the AWS Service Authorization Reference; not guaranteed current.";

  function slimPrivilegeRecord(serviceName, priv) {
    const resourceTypes = [];
    const dependentActions = [];
    const seenR = new Set();
    const seenD = new Set();
    for (const rt of priv.resource_types || []) {
      if (resourceTypes.length < LIST_CAP) {
        const t = (rt.resource_type && String(rt.resource_type).trim()) || "";
        if (t && !seenR.has(t)) {
          seenR.add(t);
          resourceTypes.push(t);
        }
      }
      const deps = rt.dependent_actions || [];
      const depArr = Array.isArray(deps) ? deps : [deps];
      for (const da of depArr) {
        if (dependentActions.length >= LIST_CAP) break;
        if (typeof da === "string" && da && !seenD.has(da)) {
          seenD.add(da);
          dependentActions.push(da);
        }
      }
      if (resourceTypes.length >= LIST_CAP && dependentActions.length >= LIST_CAP)
        break;
    }
    return {
      description: priv.description || "",
      accessLevel: priv.access_level || "",
      serviceName: serviceName || "",
      resourceTypes,
      dependentActions,
    };
  }

  console.log("🔎 Fetching iam-dataset (iam_definition.json)...");
  let actionDefinitionsOut = {
    schemaVersion: 1,
    source: "iam-dataset",
    sourceUrl: "https://github.com/iann0036/iam-dataset",
    sourceLicense: "MIT",
    attribution: attributionText,
    generatedAt: new Date().toISOString(),
    definitions: {},
  };
  try {
    const iamDefRaw = await fetchUrl(IAM_DEFINITION_URL);
    const iamDef = JSON.parse(iamDefRaw);
    const lookupByActionLower = {};
    if (Array.isArray(iamDef)) {
      for (const svc of iamDef) {
        const prefix = (svc.prefix && String(svc.prefix)) || "";
        const serviceName = (svc.service_name && String(svc.service_name)) || "";
        if (!prefix) continue;
        for (const priv of svc.privileges || []) {
          const p = priv.privilege && String(priv.privilege);
          if (!p) continue;
          const canonical = `${prefix}:${p}`;
          lookupByActionLower[canonical.toLowerCase()] = slimPrivilegeRecord(
            serviceName,
            priv
          );
        }
      }
    }
    const definitions = {};
    for (const actionKey of Object.keys(actionsOut)) {
      const row = lookupByActionLower[actionKey.toLowerCase()];
      if (row) definitions[actionKey] = row;
    }
    actionDefinitionsOut.definitions = definitions;
    const matched = Object.keys(definitions).length;
    console.log(
      `   📚 Action definitions: ${matched} of ${Object.keys(actionsOut).length} indexed actions matched iam-dataset`
    );
  } catch (err) {
    console.warn("⚠️  Could not build action definitions:", err.message);
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "action-definitions.json"),
    JSON.stringify(actionDefinitionsOut)
  );

  // Write summary data
  const summary = {
    stats,
    policies: policies.map((p) => ({
      name: p.name,
      lastModified: p.lastModified,
      createDate: p.createDate,
      versionsCount: p.versionsCount,
      versionId: p.versionId,
      actionCount: p.actionCount,
    })),
    deprecated,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  // Fetch known AWS accounts from fwdcloudsec community
  console.log("🔎 Fetching known AWS accounts...");
  try {
    const yamlText = await fetchUrl(
      "https://raw.githubusercontent.com/fwdcloudsec/known_aws_accounts/main/accounts.yaml"
    );
    const accounts = yaml.load(yamlText);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "known-accounts.json"),
      JSON.stringify(accounts, null, 2)
    );
    console.log(`   🏢 Known accounts entries: ${accounts.length}`);
  } catch (err) {
    console.warn("⚠️  Could not fetch known AWS accounts:", err.message);
  }

  // Aggregate findings from Access Analyzer validation
  console.log("🔎 Aggregating policy validation findings...");
  try {
    const findingsFiles = fs
      .readdirSync(FINDINGS_DIR)
      .filter((f) => f.endsWith(".json"));

    const byType = { ERROR: 0, SECURITY_WARNING: 0, WARNING: 0, SUGGESTION: 0 };
    const findingsPolicies = [];

    for (const file of findingsFiles) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(FINDINGS_DIR, file), "utf8")
        );
        const policyName = file.replace(/\.json$/, "");
        const stripped = raw.map((f) => ({
          findingType: f.findingType,
          findingDetails: f.findingDetails,
          issueCode: f.issueCode,
          learnMoreLink: f.learnMoreLink,
        }));
        for (const f of stripped) {
          if (byType[f.findingType] !== undefined) byType[f.findingType]++;
        }
        findingsPolicies.push({ name: policyName, findings: stripped });
      } catch (e) {
        // skip unparseable findings files
      }
    }

    findingsPolicies.sort((a, b) => a.name.localeCompare(b.name));

    const findingsData = {
      lastUpdated: new Date().toISOString().split("T")[0],
      totalPoliciesAnalyzed: policies.length,
      policiesWithFindings: findingsPolicies.length,
      byType,
      policies: findingsPolicies,
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "findings.json"),
      JSON.stringify(findingsData, null, 2)
    );
    console.log(
      `   🛡️  Findings: ${findingsPolicies.length} policies, ${Object.values(byType).reduce((a, b) => a + b, 0)} total findings`
    );
  } catch (err) {
    console.warn("⚠️  Could not aggregate findings:", err.message);
  }

  // Generate sitemap.xml
  console.log("🗺️  Generating sitemap.xml...");
  const today = new Date().toISOString().split("T")[0];
  const sitemapEntries = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/policies/", priority: "0.9", changefreq: "daily" },
    { loc: "/findings/", priority: "0.8", changefreq: "daily" },
    { loc: "/deprecated/", priority: "0.7", changefreq: "weekly" },
    { loc: "/most-active/", priority: "0.7", changefreq: "weekly" },
    { loc: "/accounts/", priority: "0.7", changefreq: "weekly" },
    { loc: "/largest-policies/", priority: "0.7", changefreq: "weekly" },
    { loc: "/service-growth/", priority: "0.7", changefreq: "weekly" },
    { loc: "/endpoints/", priority: "0.8", changefreq: "daily" },
    { loc: "/guardduty/", priority: "0.8", changefreq: "daily" },
    { loc: "/feeds/", priority: "0.5", changefreq: "weekly" },
    { loc: "/about/", priority: "0.5", changefreq: "monthly" },
  ];
  policies.forEach((p) => {
    sitemapEntries.push({
      loc: `/policies/${encodeURIComponent(p.name)}/`,
      priority: "0.6",
      changefreq: "weekly",
    });
  });
  for (const action of Object.keys(actionsOut).sort()) {
    sitemapEntries.push({
      loc: `/actions/${iamActionToSlug(action)}/`,
      priority: "0.5",
      changefreq: "weekly",
    });
  }
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (e) => `  <url>
    <loc>${SITE_URL}${e.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
  fs.writeFileSync(path.join(PUBLIC_DIR, "sitemap.xml"), sitemapXml);
  console.log(`   🗺️  Sitemap entries: ${sitemapEntries.length}`);

  console.log("✅ Data generation complete!");
  console.log(`   📁 Policies processed: ${policies.length}`);
  console.log(`   ⚠️  Errors: ${errors.length}`);
  console.log(`   📊 Output directory: ${OUTPUT_DIR}`);

  return { policies, allCommitEntries };
}

const GUARDDUTY_DIR = path.join(REPO_ROOT, "data/guardduty");

async function generateGuardDutyData() {
  console.log("\n🛡️  Generating GuardDuty announcements data...");

  if (!fs.existsSync(GUARDDUTY_DIR)) {
    console.log("   ⚠️  No data/guardduty/ found, skipping GuardDuty data generation");
    return { announcements: [] };
  }

  const files = fs
    .readdirSync(GUARDDUTY_DIR)
    .filter((f) => f.endsWith(".json") && f !== "import-summary.json")
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log("   ⚠️  No GuardDuty announcement files found");
    return { announcements: [] };
  }

  const announcements = [];
  const typeCounts = {};

  for (const file of files) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(GUARDDUTY_DIR, file), "utf8")
      );
      const type = data.type || "UNKNOWN";
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      announcements.push({
        type,
        detected_at: data.detected_at || "",
        description: data.description || "",
        short_description: data.short_description || "",
        link: data.link || "",
        gist_url: data.gist_url || "",
      });
    } catch (e) {
      console.warn(`   ⚠️  Could not parse ${file}: ${e.message}`);
    }
  }

  announcements.sort(
    (a, b) => new Date(b.detected_at) - new Date(a.detected_at)
  );

  const summary = {
    lastUpdated: new Date().toISOString(),
    stats: {
      total: announcements.length,
      typeCounts,
    },
    announcements,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "guardduty-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(
    `   🛡️  GuardDuty: ${announcements.length} announcements (${Object.entries(typeCounts)
      .map(([t, c]) => `${t}: ${c}`)
      .join(", ")})`
  );

  return { announcements };
}

const ENDPOINTS_PATH = path.join(REPO_ROOT, "data/endpoints.json");
const ENDPOINT_CHANGES_DIR = path.join(REPO_ROOT, "data/endpoint-changes");

async function generateEndpointsData() {
  console.log("\n🌐 Generating endpoints data...");

  if (!fs.existsSync(ENDPOINTS_PATH)) {
    console.log("   ⚠️  No data/endpoints.json found, skipping endpoints data generation");
    return { allChangeRecords: [] };
  }

  const endpointsRaw = JSON.parse(fs.readFileSync(ENDPOINTS_PATH, "utf8"));
  const partitions = endpointsRaw.partitions || [];

  let totalRegions = 0;
  let totalServices = 0;
  const partitionSummaries = [];

  for (const p of partitions) {
    const regions = Object.entries(p.regions || {}).map(([code, info]) => ({
      code,
      name: info.description || code,
    }));
    regions.sort((a, b) => a.code.localeCompare(b.code));

    const services = Object.entries(p.services || {}).map(([id, svc]) => {
      const endpoints = Object.keys(svc.endpoints || {});
      const nonFipsEndpoints = endpoints.filter(
        (e) =>
          !e.startsWith("fips-") &&
          e !== "aws-global" &&
          e !== "aws-cn-global" &&
          e !== "aws-us-gov-global"
      );
      return {
        id,
        endpointCount: endpoints.length,
        regionCount: nonFipsEndpoints.length,
        isRegionalized: svc.isRegionalized !== false,
      };
    });
    services.sort((a, b) => a.id.localeCompare(b.id));

    totalRegions += regions.length;
    totalServices += services.length;

    partitionSummaries.push({
      partition: p.partition,
      partitionName: p.partitionName,
      dnsSuffix: p.dnsSuffix,
      regionCount: regions.length,
      serviceCount: services.length,
      regions,
      services,
    });
  }

  let allChangeRecords = [];
  if (fs.existsSync(ENDPOINT_CHANGES_DIR)) {
    const changeFiles = fs
      .readdirSync(ENDPOINT_CHANGES_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of changeFiles) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(ENDPOINT_CHANGES_DIR, file), "utf8")
        );
        allChangeRecords.push(data);
      } catch (e) {
        console.warn(`   ⚠️  Could not parse ${file}: ${e.message}`);
      }
    }
  }

  const changeTypeCounts = {};
  const partitionCounts = {};
  const monthlyActivity = {};
  const serviceCounts = {};
  const regionCounts = {};
  const newRegionTimeline = [];

  for (const record of allChangeRecords) {
    const month = record.detected_at.slice(0, 7);
    monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;

    for (const c of record.changes) {
      changeTypeCounts[c.type] = (changeTypeCounts[c.type] || 0) + 1;
      partitionCounts[c.partition] = (partitionCounts[c.partition] || 0) + 1;

      if (c.service) {
        serviceCounts[c.service] = (serviceCounts[c.service] || 0) + 1;
      }
      if (c.new_regions) {
        for (const r of c.new_regions) {
          regionCounts[r] = (regionCounts[r] || 0) + 1;
        }
      }
      if (c.type === "new_region") {
        newRegionTimeline.push({
          region: c.id,
          partition: c.partition,
          detected_at: record.detected_at,
          description: c.description,
        });
      }
    }
  }

  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const topRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const sortedMonths = Object.entries(monthlyActivity)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  newRegionTimeline.sort(
    (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
  );

  const endpointsSummary = {
    lastUpdated: new Date().toISOString(),
    currentState: {
      totalRegions,
      totalServices,
      totalPartitions: partitions.length,
      partitions: partitionSummaries,
    },
    changeStats: {
      totalRecords: allChangeRecords.length,
      totalChangeItems: allChangeRecords.reduce(
        (s, r) => s + r.changes.length,
        0
      ),
      uniqueServices: Object.keys(serviceCounts).length,
      uniqueRegions: Object.keys(regionCounts).length,
      changeTypeCounts,
      partitionCounts,
      monthlyActivity: sortedMonths,
      topServices,
      topRegions,
      newRegionTimeline,
      trackingSince: allChangeRecords.length > 0
        ? allChangeRecords[allChangeRecords.length - 1].detected_at
        : null,
    },
    recentChanges: allChangeRecords,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "endpoints-summary.json"),
    JSON.stringify(endpointsSummary, null, 2)
  );

  console.log(
    `   🌐 Endpoints: ${totalRegions} regions, ${totalServices} services across ${partitions.length} partitions, ${allChangeRecords.length} change record(s)`
  );

  return { allChangeRecords };
}

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(FEEDS_DIR)) {
  fs.mkdirSync(FEEDS_DIR, { recursive: true });
}

function toRFC2822(dateStr) {
  return new Date(dateStr).toUTCString();
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildRSSFeed(channel, items) {
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="${item.permalink ? "true" : "false"}">${escapeXml(item.guid)}</guid>
      <pubDate>${toRFC2822(item.date)}</pubDate>${item.category ? `\n      <category>${escapeXml(item.category)}</category>` : ""}
      <description><![CDATA[${item.description}]]></description>
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${toRFC2822(new Date().toISOString())}</lastBuildDate>
    <ttl>360</ttl>
    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;
}

function generateRSSFeeds(policyData, endpointsData, guarddutyData) {
  console.log("\n📡 Generating RSS feeds...");

  const MAX_ITEMS = 50;

  // --- IAM Policies feed ---
  const seenHashes = new Set();
  const policyItems = (policyData.allCommitEntries || [])
    .filter((e) => {
      if (seenHashes.has(e.hash)) return false;
      seenHashes.add(e.hash);
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS)
    .map((e) => ({
      title: `${e.policyName} updated`,
      link: `${GITHUB_REPO}/commit/${e.hash}`,
      guid: `${GITHUB_REPO}/commit/${e.hash}`,
      permalink: true,
      date: e.date,
      category: "IAM Policy",
      description: `<p>Policy <strong>${escapeXml(e.policyName)}</strong> was updated.</p><p>${escapeXml(e.message)}</p><p><a href="${SITE_URL}/policies/${encodeURIComponent(e.policyName)}/">View on IAMTrail</a></p>`,
    }));

  const policyFeed = buildRSSFeed(
    {
      title: "IAMTrail - IAM Policy Changes",
      link: `${SITE_URL}/policies/`,
      description: "Track changes to AWS Managed IAM Policies. An unofficial archive by zoph.io.",
      feedUrl: `${SITE_URL}/feeds/iam-policies.xml`,
    },
    policyItems
  );
  fs.writeFileSync(path.join(FEEDS_DIR, "iam-policies.xml"), policyFeed);
  console.log(`   📡 IAM Policies feed: ${policyItems.length} items`);

  // --- Endpoints feed ---
  const endpointItems = (endpointsData.allChangeRecords || [])
    .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
    .slice(0, MAX_ITEMS)
    .map((r) => {
      const changeList = r.changes
        .map((c) => `<li>${escapeXml(c.description)}</li>`)
        .join("");
      return {
        title: `Endpoint changes: ${r.summary}`,
        link: r.botocore_commit_url || `${SITE_URL}/endpoints/`,
        guid: r.botocore_commit_url || `endpoint-${r.detected_at}`,
        permalink: !!r.botocore_commit_url,
        date: r.detected_at,
        category: "Endpoints",
        description: `<p>${escapeXml(r.summary)}</p><ul>${changeList}</ul><p><a href="${SITE_URL}/endpoints/">View on IAMTrail</a></p>`,
      };
    });

  const endpointsFeed = buildRSSFeed(
    {
      title: "IAMTrail - Endpoint Changes",
      link: `${SITE_URL}/endpoints/`,
      description: "Track changes to AWS service endpoints from botocore. An unofficial archive by zoph.io.",
      feedUrl: `${SITE_URL}/feeds/endpoints.xml`,
    },
    endpointItems
  );
  fs.writeFileSync(path.join(FEEDS_DIR, "endpoints.xml"), endpointsFeed);
  console.log(`   📡 Endpoints feed: ${endpointItems.length} items`);

  // --- GuardDuty feed ---
  const guarddutyItems = (guarddutyData.announcements || [])
    .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
    .slice(0, MAX_ITEMS)
    .map((a) => {
      const typeLabel = a.type.replace(/_/g, " ").toLowerCase();
      const title = a.short_description
        ? `${a.type}: ${a.short_description}`
        : `GuardDuty ${typeLabel}`;
      const descParts = [];
      if (a.description) descParts.push(`<p>${escapeXml(a.description)}</p>`);
      if (a.link) descParts.push(`<p><a href="${escapeXml(a.link)}">AWS Documentation</a></p>`);
      if (a.gist_url) descParts.push(`<p><a href="${escapeXml(a.gist_url)}">Raw SNS message</a></p>`);
      descParts.push(`<p><a href="${SITE_URL}/guardduty/">View on IAMTrail</a></p>`);
      return {
        title,
        link: a.link || a.gist_url || `${SITE_URL}/guardduty/`,
        guid: a.gist_url || `guardduty-${a.detected_at}-${a.type}`,
        permalink: !!(a.link || a.gist_url),
        date: a.detected_at,
        category: "GuardDuty",
        description: descParts.join(""),
      };
    });

  const guarddutyFeed = buildRSSFeed(
    {
      title: "IAMTrail - GuardDuty Announcements",
      link: `${SITE_URL}/guardduty/`,
      description: "Track AWS GuardDuty SNS announcements - new findings, features, and region launches. An unofficial archive by zoph.io.",
      feedUrl: `${SITE_URL}/feeds/guardduty.xml`,
    },
    guarddutyItems
  );
  fs.writeFileSync(path.join(FEEDS_DIR, "guardduty.xml"), guarddutyFeed);
  console.log(`   📡 GuardDuty feed: ${guarddutyItems.length} items`);

  // --- All-in-One feed ---
  const allItems = [...policyItems, ...endpointItems, ...guarddutyItems]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, MAX_ITEMS);

  const allFeed = buildRSSFeed(
    {
      title: "IAMTrail - All Changes",
      link: SITE_URL,
      description: "All IAMTrail changes in one feed - IAM policies, endpoints, and GuardDuty announcements. An unofficial archive by zoph.io.",
      feedUrl: `${SITE_URL}/feeds/all.xml`,
    },
    allItems
  );
  fs.writeFileSync(path.join(FEEDS_DIR, "all.xml"), allFeed);
  console.log(`   📡 All-in-One feed: ${allItems.length} items`);
}

async function main() {
  const policyData = await generatePolicyData();
  const endpointsData = await generateEndpointsData();
  const guarddutyData = await generateGuardDutyData();
  generateRSSFeeds(policyData, endpointsData, guarddutyData);
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
