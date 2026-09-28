/**
 * The command a reader runs to list the AWS managed policies attached anywhere
 * in their account. ARNs rather than names, so a customer managed policy that
 * happens to share an AWS name is never mistaken for it.
 */
export const LIST_ATTACHED_COMMAND =
  "aws iam list-policies --scope AWS --only-attached --query 'Policies[].Arn' --output text";

const AWS_MANAGED_ARN = /^arn:aws[a-z-]*:iam::aws:policy\/(?:.+\/)?([^/]+)$/;
const CUSTOMER_ARN = /^arn:aws[a-z-]*:iam::\d{12}:policy\//;
const POLICY_NAME = /^[\w+=,.@-]+$/;

export type ImportResult = {
  /** Tracked policy names, in AWS's own casing. */
  matched: string[];
  /** Names that look like AWS managed policies but are not tracked, usually deprecated. */
  unknown: string[];
  /** Customer managed policy ARNs, which IAMTrail cannot track. */
  customerManaged: number;
};

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out));
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // list-policies JSON output carries names and ARNs side by side, so reading
    // only these keys keeps VersionIds and dates out of the result.
    const keys = ["Arn", "PolicyArn", "PolicyName"].filter((k) => k in obj);
    if (keys.length > 0) {
      collectStrings(obj[keys[0]], out);
    } else {
      Object.values(obj).forEach((v) => collectStrings(v, out));
    }
  }
}

function tokens(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const out: string[] = [];
      collectStrings(JSON.parse(trimmed), out);
      return out;
    } catch {
      // Not JSON after all, so read it as text.
    }
  }
  return trimmed.split(/[\s,;|"'[\]]+/).filter(Boolean);
}

/**
 * Accepts the output of LIST_ATTACHED_COMMAND in text or JSON form, a list of
 * ARNs from anywhere else, or plain policy names one per line.
 */
export function parseAttachedPolicies(text: string, known: string[]): ImportResult {
  const byLower = new Map(known.map((name) => [name.toLowerCase(), name]));
  const matched = new Set<string>();
  const unknown = new Set<string>();
  let customerManaged = 0;

  for (const raw of tokens(text)) {
    const token = raw.trim();
    if (!token) continue;
    if (CUSTOMER_ARN.test(token)) {
      customerManaged++;
      continue;
    }
    const arn = AWS_MANAGED_ARN.exec(token);
    const name = arn ? arn[1] : token;
    const hit = byLower.get(name.toLowerCase());
    if (hit) {
      matched.add(hit);
    } else if (arn || (POLICY_NAME.test(name) && /[A-Za-z]/.test(name))) {
      unknown.add(name);
    }
  }

  return {
    matched: [...matched].sort(),
    unknown: [...unknown].sort(),
    customerManaged,
  };
}
