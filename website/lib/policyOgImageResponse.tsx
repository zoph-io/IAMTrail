import { policyOgSize } from "@/lib/policyOgSize";
import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

type PolicyRow = {
  name: string;
  lastModified: string;
  versionId: string;
  actionCount: number;
};

function loadSummary(): { policies: PolicyRow[] } {
  const dataPath = path.join(process.cwd(), "public/data/summary.json");
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function titleFontSize(name: string): number {
  if (name.length > 100) return 28;
  if (name.length > 70) return 34;
  if (name.length > 50) return 40;
  return 48;
}

/**
 * Per-policy Open Graph / social preview image (ImageResponse).
 * `decodedPolicyName` must be the real policy name (not URL-encoded).
 */
export function buildPolicyOgImageResponse(decodedPolicyName: string) {
  let policy: PolicyRow | undefined;
  try {
    const { policies } = loadSummary();
    policy = policies.find((p) => p.name === decodedPolicyName);
  } catch {
    policy = undefined;
  }

  const displayName = policy?.name ?? decodedPolicyName;
  const versionLabel = policy?.versionId
    ? `Version ${policy.versionId}`
    : "Version —";
  const actionLabel = policy
    ? `${policy.actionCount.toLocaleString()} actions`
    : "—";
  const updatedLabel = `Updated ${formatDate(policy?.lastModified ?? "")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(160deg, #0c0c0e 0%, #18181b 50%, #09090b 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                fontWeight: 700,
                color: "#fafafa",
                letterSpacing: -0.5,
              }}
            >
              IAMTrail
            </span>
            <span
              style={{
                fontSize: 28,
                fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                fontWeight: 700,
                color: "#dc2626",
              }}
            >
              _
            </span>
          </div>
          <span
            style={{
              fontSize: 18,
              color: "#a1a1aa",
              fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
            }}
          >
            AWS Managed IAM Policy
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            paddingTop: 8,
            paddingBottom: 8,
            gap: 32,
          }}
        >
          <div
            style={{
              color: "#fafafa",
              fontSize: titleFontSize(displayName),
              fontWeight: 700,
              lineHeight: 1.2,
              textAlign: "center",
              maxWidth: 1080,
              fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
              wordBreak: "break-word",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {[versionLabel, actionLabel, updatedLabel].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 8,
                  backgroundColor: "rgba(24, 24, 27, 0.9)",
                  border: "1px solid #3f3f46",
                  color: "#d4d4d8",
                  fontSize: 20,
                  fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <span
            style={{
              fontSize: 18,
              color: "#71717a",
              fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
            }}
          >
            iamtrail.com
          </span>
        </div>
      </div>
    ),
    {
      width: policyOgSize.width,
      height: policyOgSize.height,
    },
  );
}
