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

/**
 * Allow-statement wildcards from the action index: service prefix bucket, then
 * pattern, then the policies using it. The "*" bucket holds patterns whose
 * prefix is itself wildcarded, which can match an action of any service.
 */
export type WildcardGrants = Record<string, Record<string, string[]>>;

export type WildcardGrant = { pattern: string; policies: string[] };

/**
 * An IAM action pattern as a regex, matched the way IAM does: case-insensitive,
 * `*` for any run of characters and `?` for one. Mirrors iamPatternRegex in
 * scripts/generate-data.js, which builds the index this is matched against.
 */
export function iamPatternRegex(pattern: string): RegExp {
  let body = "";
  for (const ch of pattern) {
    if (ch === "*") body += ".*";
    else if (ch === "?") body += ".";
    else body += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${body}$`, "i");
}

export function wildcardBucket(pattern: string): string {
  const colon = pattern.indexOf(":");
  const prefix = colon > 0 ? pattern.slice(0, colon) : pattern;
  return /[*?]/.test(prefix) ? "*" : prefix.toLowerCase();
}

const compiled = new Map<string, RegExp>();

function regexFor(pattern: string): RegExp {
  let re = compiled.get(pattern);
  if (!re) {
    re = iamPatternRegex(pattern);
    compiled.set(pattern, re);
  }
  return re;
}

/** Every wildcard pattern that grants this action, with the policies using it. */
export function matchWildcardGrants(
  grants: WildcardGrants | undefined,
  action: string
): WildcardGrant[] {
  if (!grants) return [];
  const out: WildcardGrant[] = [];
  for (const bucket of [wildcardBucket(action), "*"]) {
    for (const [pattern, policies] of Object.entries(grants[bucket] ?? {})) {
      if (regexFor(pattern).test(action)) out.push({ pattern, policies });
    }
  }
  return out;
}
