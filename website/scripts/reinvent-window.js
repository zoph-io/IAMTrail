/**
 * The re:Invent season IAMTrail archives: October 1 through December 31.
 *
 * AWS often ships the IAM component, and the announcement, in October and
 * November, weeks before the conference. The old Nov 15 - Dec 15 window missed
 * that lead-in. 2019 is the archive import, not a season.
 *
 * Conference dates and the AWS News Blog roundup URLs live in
 * website/data/reinvent-editions.json. A year with no entry there still appears
 * as soon as the archive has a sighting, so a new season does not wait on anyone
 * to type a URL.
 *
 * What's New year indexes 404. Posts come from website/scripts/whats-new.js,
 * and a launch before the conference is timing "before" (pre-re:Invent).
 */

const WINDOW_LABEL = "October 1 through December 31";
const START = 10 * 100 + 1;
const END = 12 * 100 + 31;
const EXCLUDED_YEARS = new Set([2019]);

function seasonYear(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (EXCLUDED_YEARS.has(year)) return null;
  const key = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  if (key < START || key > END) return null;
  return String(year);
}

function day(value) {
  return String(value || "").slice(0, 10);
}

function timingFor(firstSeen, edition) {
  if (!edition || !edition.starts || !edition.ends) return null;
  const d = day(firstSeen);
  if (!d) return null;
  if (d < edition.starts) return "before";
  if (d > edition.ends) return "after";
  return "during";
}

function prefixOf(action) {
  const idx = String(action).indexOf(":");
  return idx === -1 ? "" : action.slice(0, idx).toLowerCase();
}

function maxDay(values) {
  let max = "";
  for (const value of values) {
    const d = day(value);
    if (d && d > max) max = d;
  }
  return max || null;
}

function decorate(action, permissions) {
  return {
    action: action.action,
    firstSeen: day(action.firstSeen),
    firstPolicy: action.firstPolicy || "",
    hasPage: Boolean(action.hasPage),
    permissionsManagement: permissions.has(String(action.action).toLowerCase()),
  };
}

/**
 * One document for /reinvent and /api/v1/reinvent.json.
 * Years are newest first. The open season is included even when nothing has
 * been spotted yet, so the page can say so instead of disappearing.
 */
function whatsNewFor(year, meta, whatsNewByYear, whatsNewUnavailable) {
  if (whatsNewUnavailable) return { available: false, items: [] };
  if (!whatsNewByYear) return { available: true, items: [] };
  const row = whatsNewByYear[year];
  if (!row || row.available === false) return { available: false, items: [] };
  const items = (row.posts || [])
    .map((post) => ({
      headline: String(post.headline || "")
        .replace(/\s+/g, " ")
        .trim(),
      url: post.url,
      date: day(post.date),
      timing: timingFor(post.date, meta),
    }))
    .filter((post) => post.headline && post.url && post.date)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.headline.localeCompare(b.headline)
    );
  return { available: true, items };
}

function buildArchive({
  generatedAt,
  services = [],
  actions = [],
  policies = [],
  changeDates = [],
  endpointChanges = [],
  announcements = [],
  editions = {},
  serviceNames = {},
  permissions = new Set(),
  whatsNewByYear = null,
  whatsNewUnavailable = false,
}) {
  const perm = permissions instanceof Set ? permissions : new Set(permissions);
  const currentYear = seasonYear(generatedAt);
  const byYear = new Map();

  function bucket(year) {
    let row = byYear.get(year);
    if (!row) {
      row = {
        services: [],
        actions: [],
        policies: [],
        changes: 0,
        endpointChanges: [],
        announcements: [],
      };
      byYear.set(year, row);
    }
    return row;
  }

  if (currentYear) bucket(currentYear);

  for (const service of services) {
    const year = seasonYear(service.firstSeen);
    if (year) bucket(year).services.push(service);
  }
  for (const action of actions) {
    const year = seasonYear(action.firstSeen);
    if (year) bucket(year).actions.push(action);
  }
  for (const policy of policies) {
    const year = seasonYear(policy.firstSeen);
    if (!year || !policy.name) continue;
    bucket(year).policies.push(policy);
  }
  for (const date of changeDates) {
    const year = seasonYear(date);
    if (year) bucket(year).changes += 1;
  }
  for (const change of endpointChanges) {
    const year = seasonYear(change.detectedAt);
    if (year) bucket(year).endpointChanges.push(change);
  }
  for (const announcement of announcements) {
    const year = seasonYear(announcement.detected_at || announcement.detectedAt);
    if (year) bucket(year).announcements.push(announcement);
  }

  const built = [...byYear.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((year) => {
      const row = byYear.get(year);
      const meta = editions[year] || {};
      const actionsByPrefix = new Map();
      for (const action of row.actions) {
        const prefix = prefixOf(action.action);
        if (!prefix) continue;
        if (!actionsByPrefix.has(prefix)) actionsByPrefix.set(prefix, []);
        actionsByPrefix.get(prefix).push(decorate(action, perm));
      }
      for (const list of actionsByPrefix.values()) {
        list.sort((a, b) => a.action.localeCompare(b.action));
      }

      const servicePrefixes = new Set();
      const serviceRows = row.services
        .map((service) => {
          const prefix = String(service.prefix || "").toLowerCase();
          if (!prefix || servicePrefixes.has(prefix)) return null;
          servicePrefixes.add(prefix);
          const name = serviceNames[prefix] || null;
          return {
            prefix,
            name,
            firstSeen: day(service.firstSeen),
            firstPolicy: service.firstPolicy || "",
            timing: timingFor(service.firstSeen, meta),
            actions: actionsByPrefix.get(prefix) || [],
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.firstSeen.localeCompare(a.firstSeen) ||
            a.prefix.localeCompare(b.prefix)
        );

      const actionGroups = [...actionsByPrefix.entries()]
        .filter(([prefix]) => !servicePrefixes.has(prefix))
        .map(([prefix, list]) => {
          const earliest = list.reduce((best, action) =>
            !best || action.firstSeen < best.firstSeen ? action : best
          );
          return {
            prefix,
            name: serviceNames[prefix] || null,
            firstSeen: earliest ? earliest.firstSeen : "",
            firstPolicy: earliest ? earliest.firstPolicy : "",
            actions: list,
          };
        })
        .sort(
          (a, b) =>
            b.actions.length - a.actions.length ||
            a.prefix.localeCompare(b.prefix)
        );

      const seenPolicies = new Set();
      const newPolicies = row.policies
        .filter((policy) => {
          if (seenPolicies.has(policy.name)) return false;
          seenPolicies.add(policy.name);
          return true;
        })
        .map((policy) => ({
          name: policy.name,
          firstSeen: day(policy.firstSeen),
        }))
        .sort(
          (a, b) =>
            b.firstSeen.localeCompare(a.firstSeen) ||
            a.name.localeCompare(b.name)
        );

      const regions = new Map();
      const endpointServices = new Map();
      let expansions = 0;
      for (const change of row.endpointChanges) {
        if (change.type === "new_region" && change.id && !regions.has(change.id)) {
          regions.set(change.id, {
            id: change.id,
            description: change.description || change.id,
            detectedAt: day(change.detectedAt),
          });
        } else if (
          change.type === "new_service" &&
          change.id &&
          !endpointServices.has(change.id)
        ) {
          endpointServices.set(change.id, {
            id: change.id,
            description: change.description || change.id,
            detectedAt: day(change.detectedAt),
          });
        } else if (change.type === "service_expansion") {
          expansions += 1;
        }
      }

      const guarddutyItems = row.announcements
        .map((announcement) => {
          const title = String(
            announcement.short_description ||
              announcement.description ||
              announcement.type ||
              ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 180);
          return {
            detectedAt: day(announcement.detected_at || announcement.detectedAt),
            title,
            href: announcement.link || announcement.gist_url || null,
            type: announcement.type || "",
          };
        })
        .filter((item) => item.title)
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

      const permissionsManagement = [];
      const seenPerm = new Set();
      for (const list of actionsByPrefix.values()) {
        for (const action of list) {
          if (!action.permissionsManagement || seenPerm.has(action.action)) continue;
          seenPerm.add(action.action);
          permissionsManagement.push(action);
        }
      }
      permissionsManagement.sort((a, b) => a.action.localeCompare(b.action));

      const whatsNewPosts = whatsNewFor(
        year,
        meta,
        whatsNewByYear,
        whatsNewUnavailable
      );

      const lastmod = maxDay([
        ...serviceRows.map((service) => service.firstSeen),
        ...row.actions.map((action) => action.firstSeen),
        ...newPolicies.map((policy) => policy.firstSeen),
        ...row.endpointChanges.map((change) => change.detectedAt),
        ...guarddutyItems.map((item) => item.detectedAt),
        ...whatsNewPosts.items.map((post) => post.date),
      ]);

      return {
        year,
        status: year === currentYear ? "open" : "closed",
        conference:
          meta.starts && meta.ends
            ? { starts: meta.starts, ends: meta.ends, place: meta.place || "" }
            : null,
        roundup: meta.roundup
          ? {
              url: meta.roundup,
              title: meta.roundupTitle || "Announcement roundup",
            }
          : null,
        eventUrl: meta.event || null,
        whatsNewPosts,
        changes: row.changes,
        newPolicies,
        services: serviceRows,
        actionGroups,
        neverBeforeSeen: row.actions.length,
        beforeConference: serviceRows.filter((service) => service.timing === "before")
          .length,
        permissionsManagement,
        endpoints: {
          newRegions: [...regions.values()].sort((a, b) =>
            a.detectedAt.localeCompare(b.detectedAt)
          ),
          newServices: [...endpointServices.values()].sort((a, b) =>
            a.detectedAt.localeCompare(b.detectedAt)
          ),
          expansions,
        },
        guardduty: {
          total: row.announcements.length,
          items: guarddutyItems.slice(0, 8),
        },
        lastmod,
      };
    });

  const indexLastmod = built.reduce(
    (max, edition) =>
      edition.lastmod && (!max || edition.lastmod > max) ? edition.lastmod : max,
    null
  );

  return {
    schemaVersion: 1,
    generatedAt,
    windowLabel: WINDOW_LABEL,
    currentYear,
    lastmod: indexLastmod,
    editions: built,
  };
}

module.exports = {
  WINDOW_LABEL,
  seasonYear,
  timingFor,
  buildArchive,
};
