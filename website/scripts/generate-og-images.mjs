#!/usr/bin/env node
/**
 * Incremental per-policy Open Graph image generation.
 *
 * Renders one PNG per policy into public/policies/<name>/opengraph.png, which
 * the static export copies to out/, keeping the exact same public URL the old
 * app/policies/[name]/opengraph.png route served
 * (https://iamtrail.com/policies/<name>/opengraph.png).
 *
 * Moving this out of the Next.js build removes ~1,560 ImageResponse renders
 * from every export. A manifest (.og-manifest.json) records the visible
 * fields each PNG was rendered from, so only policies whose card content
 * changed are re-rendered (the directory is cached across CI runs).
 *
 * The layout mirrors the old lib/policyOgImageResponse.tsx, expressed as
 * plain {type, props} element objects (what JSX compiles to) since this runs
 * as a standalone Node script. Keep in sync with lib/policyOgSize.ts.
 */

import { ImageResponse } from "next/og.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUMMARY_PATH = path.join(__dirname, "../public/data/summary.json");
const OG_ROOT = path.join(__dirname, "../public/policies");
// Outside public/ so it is not copied into out/ and deployed
const MANIFEST_PATH = path.join(__dirname, "../.og-manifest.json");

const OG_SIZE = { width: 1200, height: 630 }; // must match lib/policyOgSize.ts

const MONO = "ui-monospace, Menlo, Monaco, Consolas, monospace";

/** JSX-free element helper: h(type, props, ...children) */
function h(type, props = {}, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined);
  return {
    type,
    key: null,
    props: flat.length
      ? { ...props, children: flat.length === 1 ? flat[0] : flat }
      : props,
  };
}

function formatDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function titleFontSize(name) {
  if (name.length > 100) return 28;
  if (name.length > 70) return 34;
  if (name.length > 50) return 40;
  return 48;
}

function policyOgElement(policy) {
  const displayName = policy.name;
  const versionLabel = policy.versionId
    ? `Version ${policy.versionId}`
    : "Version —";
  const actionLabel =
    typeof policy.actionCount === "number"
      ? `${policy.actionCount.toLocaleString("en-US")} actions`
      : "—";
  const updatedLabel = `Updated ${formatDate(policy.lastModified ?? "")}`;

  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 56,
        background:
          "linear-gradient(160deg, #0c0c0e 0%, #18181b 50%, #09090b 100%)",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
          },
        },
        h(
          "span",
          {
            style: {
              fontSize: 28,
              fontFamily: MONO,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: -0.5,
            },
          },
          "IAMTrail"
        ),
        h(
          "span",
          {
            style: {
              fontSize: 28,
              fontFamily: MONO,
              fontWeight: 700,
              color: "#dc2626",
            },
          },
          "_"
        )
      ),
      h(
        "span",
        {
          style: { fontSize: 18, color: "#a1a1aa", fontFamily: MONO },
        },
        "AWS Managed IAM Policy"
      )
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          paddingTop: 8,
          paddingBottom: 8,
          gap: 32,
        },
      },
      h(
        "div",
        {
          style: {
            color: "#fafafa",
            fontSize: titleFontSize(displayName),
            fontWeight: 700,
            lineHeight: 1.2,
            textAlign: "center",
            maxWidth: 1080,
            fontFamily: MONO,
            wordBreak: "break-word",
          },
        },
        displayName
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            alignItems: "center",
          },
        },
        [versionLabel, actionLabel, updatedLabel].map((label) =>
          h(
            "div",
            {
              key: label,
              style: {
                display: "flex",
                padding: "10px 18px",
                borderRadius: 8,
                backgroundColor: "rgba(24, 24, 27, 0.9)",
                border: "1px solid #3f3f46",
                color: "#d4d4d8",
                fontSize: 20,
                fontFamily: MONO,
              },
            },
            label
          )
        )
      )
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        },
      },
      h(
        "span",
        {
          style: { fontSize: 18, color: "#71717a", fontFamily: MONO },
        },
        "iamtrail.com"
      )
    )
  );
}

/** Hash of the fields that are visible on the card. */
function renderKey(policy) {
  return crypto
    .createHash("md5")
    .update(
      JSON.stringify({
        v: 1, // bump to force a full re-render after layout changes
        name: policy.name,
        versionId: policy.versionId ?? null,
        actionCount: policy.actionCount ?? null,
        updated: formatDate(policy.lastModified ?? ""),
      })
    )
    .digest("hex");
}

async function renderPng(policy) {
  const res = new ImageResponse(policyOgElement(policy), OG_SIZE);
  return Buffer.from(await res.arrayBuffer());
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  if (!fs.existsSync(SUMMARY_PATH)) {
    console.warn(
      "⚠️  public/data/summary.json missing; skipping OG image generation (run generate-data first)"
    );
    return;
  }
  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
  const policies = summary.policies || [];

  fs.mkdirSync(OG_ROOT, { recursive: true });
  const manifest = loadManifest();
  const nextManifest = {};

  let rendered = 0;
  let reused = 0;
  for (const policy of policies) {
    const key = renderKey(policy);
    nextManifest[policy.name] = key;
    const pngPath = path.join(OG_ROOT, policy.name, "opengraph.png");
    if (manifest[policy.name] === key && fs.existsSync(pngPath)) {
      reused++;
      continue;
    }
    const png = await renderPng(policy);
    fs.mkdirSync(path.dirname(pngPath), { recursive: true });
    fs.writeFileSync(pngPath, png);
    rendered++;
  }

  // Prune images for policies that no longer exist (deprecated/removed)
  let pruned = 0;
  const known = new Set(policies.map((p) => p.name));
  for (const entry of fs.readdirSync(OG_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!known.has(entry.name)) {
      fs.rmSync(path.join(OG_ROOT, entry.name), { recursive: true, force: true });
      pruned++;
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2));
  console.log(
    `🖼️  OG images: ${rendered} rendered, ${reused} reused, ${pruned} pruned (${policies.length} policies)`
  );
}

main().catch((err) => {
  console.error("💥 OG image generation failed:", err);
  process.exit(1);
});
