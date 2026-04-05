/**
 * True when the string is treated as a literal IAM action in the action index
 * (same rules as website/scripts/generate-data.js: no wildcards).
 */
export function isLiteralIamActionString(s: string): boolean {
  if (typeof s !== "string" || s.length === 0) return false;
  if (s.includes("*")) return false;
  const idx = s.indexOf(":");
  if (idx <= 0 || idx >= s.length - 1) return false;
  return true;
}
