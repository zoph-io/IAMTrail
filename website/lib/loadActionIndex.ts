import fs from "fs";
import path from "path";

export type ActionDetail = {
  actionAllowPolicies: string[];
  actionDenyPolicies: string[];
  notActionPolicies: string[];
};

export type ActionIndexFile = {
  schemaVersion: number;
  generatedAt: string;
  stats: {
    uniqueLiteralActionCount: number;
    policiesWithWildcardActions: number;
    wildcardPoliciesByService?: Record<string, number>;
  };
  effectiveGrantPreview: unknown;
  actions: Record<string, ActionDetail>;
};

let cached: ActionIndexFile | null | undefined;

function readIndex(): ActionIndexFile | null {
  if (cached !== undefined) return cached;
  const dataPath = path.join(process.cwd(), "public/data/action-index.json");
  if (!fs.existsSync(dataPath)) {
    cached = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(dataPath, "utf8");
    cached = JSON.parse(raw) as ActionIndexFile;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function getActionDetail(action: string): ActionDetail | null {
  const idx = readIndex();
  if (!idx?.actions) return null;
  const detail = idx.actions[action];
  return detail ?? null;
}

/** Call only when a matching action detail exists (same backing file). */
export function getActionIndex(): ActionIndexFile {
  const idx = readIndex();
  if (!idx) {
    throw new Error("action-index.json missing; run npm run generate-data");
  }
  return idx;
}
