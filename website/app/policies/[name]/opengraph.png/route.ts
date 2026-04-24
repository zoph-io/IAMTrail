import { buildPolicyOgImageResponse } from "@/lib/policyOgImageResponse";
import fs from "node:fs";
import path from "node:path";

/**
 * Serves a real `.png` URL in static export (S3/CloudFront).
 * Extensionless `opengraph-image` is often missing or mapped to `index.html`.
 */
export function generateStaticParams() {
  const dataPath = path.join(process.cwd(), "public/data/summary.json");
  try {
    const data = fs.readFileSync(dataPath, "utf8");
    const summary = JSON.parse(data);
    return summary.policies.map((policy: { name: string }) => ({
      name: policy.name,
    }));
  } catch (e) {
    console.error("opengraph.png generateStaticParams:", e);
    return [];
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name: rawName } = await context.params;
  const decoded = decodeURIComponent(rawName);
  return buildPolicyOgImageResponse(decoded);
}

export const dynamic = "force-static";
