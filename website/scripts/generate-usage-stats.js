const fs = require("fs");
const path = require("path");
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} = require("@aws-sdk/client-cloudwatch");

const OUTPUT = path.join(__dirname, "../public/data/usage-stats.json");

const SUBS_TABLE = "iamtrail-subscriptions";
const DDB_REGION = "eu-west-1";
const SES_CW_REGION = "eu-west-3";
const LAUNCH_ISO = "2026-03-11T00:00:00.000Z";
const MS_DAY = 86400_000;
const ROLLING_DAYS = 30;

const DEFAULT_TOPICS = ["iam_policies"];

const STUB = {
  available: false,
  generatedAt: null,
  launchDate: LAUNCH_ISO,
  displaySubscriberCount: null,
  confirmedCountExact: null,
  daysActive: null,
  totalSend: null,
  last30DaysSend: null,
  frequency: { daily: 0, weekly: 0, instant: 0 },
  topics: { iam_policies: 0, endpoints: 0, guardduty: 0 },
  allPoliciesSubscribers: 0,
  narrowSubscribers: 0,
  topNarrowPolicies: [],
  signupsByMonth: [],
};

function roundSubscribers(n) {
  if (n >= 50) return n;
  return Math.round(n / 5) * 5;
}

function loadExistingOrStub() {
  if (fs.existsSync(OUTPUT)) {
    try {
      return JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
    } catch {
      // fall through
    }
  }
  return { ...STUB, reason: "reused_or_invalid_cached_file" };
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {import('@aws-sdk/client-cloudwatch').CloudWatchClient} cw
 * @returns {Promise<number>}
 */
async function sumSendMetric(cw, start, end) {
  const res = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: "AWS/SES",
      MetricName: "Send",
      StartTime: start,
      EndTime: end,
      Period: 86400,
      Statistics: ["Sum"],
    })
  );
  return (res.Datapoints || []).reduce((s, p) => s + (p.Sum || 0), 0);
}

/**
 * @returns {Promise<object>}
 */
async function buildFromAws() {
  const launch = new Date(LAUNCH_ISO);
  const now = new Date();
  const ddb = new DynamoDBClient({ region: DDB_REGION });
  const cw = new CloudWatchClient({ region: SES_CW_REGION });

  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: SUBS_TABLE,
        ExclusiveStartKey: lastKey,
      })
    );
    (res.Items || []).forEach((raw) => items.push(unmarshall(raw)));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const confirmed = items.filter((it) => it.confirmed === true);
  const confirmedCount = confirmed.length;

  const frequency = { daily: 0, weekly: 0, instant: 0 };
  const topicCounts = { iam_policies: 0, endpoints: 0, guardduty: 0 };
  let allPolicies = 0;
  let narrow = 0;
  /** @type {Map<string, number>} */
  const policyCounts = new Map();
  /** @type {Map<string, number>} */
  const byMonth = new Map();

  for (const s of confirmed) {
    const freq = s.frequency || "daily";
    if (freq === "daily") frequency.daily += 1;
    else if (freq === "weekly") frequency.weekly += 1;
    else if (freq === "instant") frequency.instant += 1;

    const topics = Array.isArray(s.topics) && s.topics.length
      ? s.topics
      : DEFAULT_TOPICS;
    for (const t of ["iam_policies", "endpoints", "guardduty"]) {
      if (topics.includes(t)) topicCounts[t] += 1;
    }

    const policies = Array.isArray(s.policies) ? s.policies : ["*"];
    const isAll = policies.length === 1 && policies[0] === "*";
    if (isAll) {
      allPolicies += 1;
    } else {
      narrow += 1;
      for (const p of policies) {
        if (p === "*") continue;
        policyCounts.set(p, (policyCounts.get(p) || 0) + 1);
      }
    }

    const created = s.created_at;
    if (typeof created === "string" && created.length >= 7) {
      const ym = created.slice(0, 7);
      byMonth.set(ym, (byMonth.get(ym) || 0) + 1);
    }
  }

  const topNarrowPolicies = [...policyCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const signupsByMonth = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  const endOfMetrics = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const totalSend = await sumSendMetric(
    cw,
    launch,
    endOfMetrics
  );

  const start30 = new Date(now.getTime() - ROLLING_DAYS * MS_DAY);
  const last30DaysSend = await sumSendMetric(
    cw,
    start30,
    endOfMetrics
  );

  const dayStart = (d) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysActive = Math.max(
    1,
    Math.floor((dayStart(now) - dayStart(launch)) / MS_DAY) + 1
  );

  return {
    available: true,
    generatedAt: now.toISOString(),
    launchDate: LAUNCH_ISO,
    displaySubscriberCount: roundSubscribers(confirmedCount),
    confirmedCountExact: confirmedCount,
    daysActive,
    totalSend,
    last30DaysSend,
    frequency,
    topics: topicCounts,
    allPoliciesSubscribers: allPolicies,
    narrowSubscribers: narrow,
    topNarrowPolicies,
    signupsByMonth,
  };
}

async function generateUsageStats() {
  const out = path.join(OUTPUT);
  try {
    const data = await buildFromAws();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n", "utf8");
    const label = data.available
      ? `subscribers~${data.displaySubscriberCount} send~${data.totalSend}`
      : "stub";
    console.log(`   📧 Usage stats: ${label}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const prev = loadExistingOrStub();
    if (prev && prev.available === true) {
      console.warn(
        "   📧 Usage stats: AWS error; keeping existing snapshot (",
        msg,
        ")"
      );
      return;
    }
    const merged = { ...STUB, ...prev, available: false, reason: msg };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(
      out,
      JSON.stringify(merged, null, 2) + "\n",
      "utf8"
    );
    console.warn("   📧 Usage stats: skipped (", msg, "- wrote fallback stub)");
  }
}

module.exports = { generateUsageStats, buildFromAws, roundSubscribers };

if (require.main === module) {
  generateUsageStats()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
