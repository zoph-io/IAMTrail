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
  actions: ReinventAction[];
};

export type ReinventActionGroup = {
  prefix: string;
  name: string | null;
  firstSeen: string;
  firstPolicy: string;
  actions: ReinventAction[];
};

export type ReinventEdition = {
  year: string;
  status: "open" | "closed";
  conference: { starts: string; ends: string; place: string } | null;
  roundup: { url: string; title: string } | null;
  whatsNew: string;
  eventUrl: string | null;
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
  before: "Before the conference",
  during: "During the conference",
  after: "After the conference",
};

export function timingLabel(timing: ReinventTiming | null): string {
  return timing ? TIMING_LABEL[timing] : "";
}
