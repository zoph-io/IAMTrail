/**
 * URL-safe slug for a literal IAM action string (must match website/scripts/generate-data.js).
 */
export function iamActionToSlug(action: string): string {
  let b64: string;
  if (typeof Buffer !== "undefined") {
    b64 = Buffer.from(action, "utf8").toString("base64");
  } else {
    const bytes = new TextEncoder().encode(action);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Decode slug from /actions/[action]/ back to the IAM action string.
 */
export function iamSlugToAction(slug: string): string {
  const normalized = slug.trim();
  if (!normalized) throw new Error("empty action slug");
  const b64 = normalized.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(pad);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(out);
}
