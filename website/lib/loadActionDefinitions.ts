import fs from "fs";
import path from "path";

export type ActionDefinitionRow = {
  description: string;
  accessLevel: string;
  serviceName: string;
  resourceTypes: string[];
  dependentActions: string[];
};

export type ActionDefinitionsFile = {
  schemaVersion: number;
  source: string;
  sourceUrl: string;
  sourceLicense: string;
  attribution: string;
  generatedAt: string;
  definitions: Record<string, ActionDefinitionRow>;
};

let cached: ActionDefinitionsFile | null | undefined;

function readDefinitions(): ActionDefinitionsFile | null {
  if (cached !== undefined) return cached;
  const dataPath = path.join(
    process.cwd(),
    "public/data/action-definitions.json"
  );
  if (!fs.existsSync(dataPath)) {
    cached = null;
    return null;
  }
  try {
    const raw = fs.readFileSync(dataPath, "utf8");
    cached = JSON.parse(raw) as ActionDefinitionsFile;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function getActionDefinition(
  action: string
): ActionDefinitionRow | null {
  const file = readDefinitions();
  if (!file?.definitions) return null;
  return file.definitions[action] ?? null;
}

/** File-level attribution (Ian McKay / iam-dataset). */
export function getActionDefinitionsMeta(): Pick<
  ActionDefinitionsFile,
  "attribution" | "sourceUrl" | "sourceLicense" | "generatedAt"
> | null {
  const file = readDefinitions();
  if (!file) return null;
  return {
    attribution: file.attribution,
    sourceUrl: file.sourceUrl,
    sourceLicense: file.sourceLicense,
    generatedAt: file.generatedAt,
  };
}
