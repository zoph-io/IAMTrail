export type ReinventTiming = "before" | "during" | "after";

export type ReinventAction = {
  action: string;
  firstSeen: string;
  firstPolicy: string;
  hasPage: boolean;
  permissionsManagement: boolean;
};

export type ReinventService = {
  prefix: string;
  name: string | null;
  firstSeen: string;
  firstPolicy: string;
  timing: ReinventTiming | null;
  /** "new": not in AWS's IAM reference when docs history began. null: no history for that date. */
  kind: "new" | "existing" | null;
  /** First day AWS's Service Authorization Reference listed the prefix. */
  docsSince: string | null;
  /** The managed policy came at least a day before the docs. */
  spottedFirst: boolean;
  announcement: { headline: string; url: string; date: string } | null;
  actions: ReinventAction[];
};

export type ReinventActionGroup = {
  prefix: string;
  name: string | null;
  firstSeen: string;
  firstPolicy: string;
  actions: ReinventAction[];
};

export type WhatsNewPost = {
  headline: string;
  url: string;
  date: string;
  timing: ReinventTiming | null;
};

export type ReinventEdition = {
  year: string;
  status: "open" | "closed";
  conference: { starts: string; ends: string; place: string } | null;
  roundup: { url: string; title: string } | null;
  eventUrl: string | null;
  whatsNewPosts: { available: boolean; items: WhatsNewPost[] };
  changes: number;
  newPolicies: { name: string; firstSeen: string }[];
  services: ReinventService[];
  actionGroups: ReinventActionGroup[];
  neverBeforeSeen: number;
  beforeConference: number;
  permissionsManagement: ReinventAction[];
  endpoints: {
    newRegions: { id: string; description: string; detectedAt: string }[];
    newServices: { id: string; description: string; detectedAt: string }[];
    expansions: number;
  };
  guardduty: {
    total: number;
    items: { detectedAt: string; title: string; href: string | null; type: string }[];
  };
  lastmod: string | null;
};

export type ReinventFile = {
  schemaVersion: number;
  generatedAt: string;
  docsHistoryStart: string | null;
  windowLabel: string;
  currentYear: string | null;
  lastmod: string | null;
  editions: ReinventEdition[];
};

export function loadReinvent(): ReinventFile {
  const fs = require("fs");
  const path = require("path");
  const dataPath = path.join(process.cwd(), "public/data/reinvent.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      "public/data/reinvent.json is missing: run npm run generate-data",
    );
  }
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

export function formatDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Dec 2-6, 2024 in Las Vegas" or "Nov 30 - Dec 18, 2020, virtual". */
export function conferenceLabel(
  conference: ReinventEdition["conference"],
): string {
  if (!conference) return "";
  const start = new Date(`${conference.starts}T00:00:00Z`);
  const end = new Date(`${conference.ends}T00:00:00Z`);
  const startMonth = start.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const range =
    startMonth === endMonth
      ? `${startMonth} ${start.getUTCDate()}-${end.getUTCDate()}, ${end.getUTCFullYear()}`
      : `${startMonth} ${start.getUTCDate()} - ${endMonth} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  if (!conference.place) return range;
  if (conference.place === "Virtual") return `${range}, virtual`;
  return `${range} in ${conference.place}`;
}

export function endpointTotal(edition: ReinventEdition): number {
  return (
    edition.endpoints.newRegions.length +
    edition.endpoints.newServices.length +
    edition.endpoints.expansions
  );
}

const TIMING_LABEL: Record<ReinventTiming, string> = {
  before: "Pre-re:Invent",
  during: "During the conference",
  after: "After the conference",
};

/** null when the feed failed. An empty array is a season with no pre-re:Invent post. */
export function preReinventionPosts(
  edition: ReinventEdition,
): WhatsNewPost[] | null {
  if (!edition.whatsNewPosts.available) return null;
  return edition.whatsNewPosts.items.filter((item) => item.timing === "before");
}

export function timingLabel(timing: ReinventTiming | null): string {
  return timing ? TIMING_LABEL[timing] : "";
}

/** Services worth watching: brand-new ones, or every one when the season predates docs history. */
export function spottedServices(edition: ReinventEdition): ReinventService[] {
  return edition.services.filter((service) => service.kind !== "existing");
}

/** Existing AWS services that only now show up in a managed policy. */
export function existingServices(edition: ReinventEdition): ReinventService[] {
  return edition.services.filter((service) => service.kind === "existing");
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Where the conference stands on the day the data was built: the page is
 * static, so this is "as of" generatedAt, not the reader's clock.
 */
export function conferenceStatus(
  edition: ReinventEdition,
  generatedAt: string,
): { phase: "upcoming" | "live" | "past"; days: number } | null {
  if (!edition.conference) return null;
  const today = generatedAt.slice(0, 10);
  if (today < edition.conference.starts) {
    return { phase: "upcoming", days: daysBetween(today, edition.conference.starts) };
  }
  if (today <= edition.conference.ends) {
    return { phase: "live", days: daysBetween(edition.conference.starts, today) + 1 };
  }
  return { phase: "past", days: 0 };
}

/** Days from the IAM sighting to the announcement; negative when AWS announced first. */
export function leadDays(service: ReinventService): number | null {
  if (!service.announcement) return null;
  return daysBetween(service.firstSeen, service.announcement.date);
}
