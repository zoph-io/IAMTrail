import type { Metadata } from "next";
import { policyOgSize } from "@/lib/policyOgSize";
import { plural } from "@/lib/changes";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import PolicyDetailClient, { type PolicyData } from "./PolicyDetailClient";

function readData(file: string) {
  const fs = require("fs");
  const path = require("path");
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public/data", file), "utf8"),
  );
}

export async function generateStaticParams() {
  try {
    const summary = readData("summary.json");
    return summary.policies.map((policy: any) => ({
      name: policy.name,
    }));
  } catch (error) {
    console.error("Error loading policies for static params:", error);
    return [];
  }
}

/**
 * Read at build time so the page ships its content in the HTML. It used to be
 * fetched in the browser, which left crawlers a "Loading policy..." spinner on
 * every one of the archive's most searched pages. A policy listed in summary.json
 * without its file is a broken build, so this throws rather than render empty.
 */
function loadPolicy(name: string): PolicyData {
  return readData(`${name}.json`);
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whether any statement names an action through a wildcard, like s3:Get*. */
function hasWildcardAction(content: any): boolean {
  const statements = content?.PolicyVersion?.Document?.Statement ?? [];
  return (Array.isArray(statements) ? statements : [statements]).some((s: any) =>
    [s?.Action, s?.NotAction]
      .flat()
      .some((a: unknown) => typeof a === "string" && a.includes("*")),
  );
}

/**
 * A description unique to the policy, from the richest wording to the leanest so
 * a long policy name drops detail instead of losing its date to truncation.
 */
function describe(policy: PolicyData): string {
  // actionCount counts action strings as written, patterns and Deny included,
  // so "naming" rather than "granting", which would count s3:Get* as one action.
  let actions = "";
  if (policy.actionCount) {
    actions = hasWildcardAction(policy.content)
      ? plural(policy.actionCount, "IAM action or wildcard", "IAM actions or wildcards")
      : plural(policy.actionCount, "IAM action");
  }
  const services = policy.servicePrefixes?.length ?? 0;
  const across = services > 1 ? ` across ${plural(services, "service")}` : "";
  const since = policy.firstSeen ?? policy.createDate;
  const history = `${plural(policy.versionsCount, "version")}${
    since ? ` since ${new Date(since).getUTCFullYear()}` : ""
  }`;
  const status = policy.deprecation
    ? policy.deprecation.date !== "Unknown"
      ? `removed by AWS on ${policy.deprecation.date}`
      : "removed by AWS"
    : `last changed ${formatDay(policy.lastModified)}`;

  const name = policy.name;
  const candidates = [
    actions && `${name} is an AWS managed IAM policy naming ${actions}${across}. ${history}, ${status}. Full JSON and diffs.`,
    actions && `${name} is an AWS managed IAM policy naming ${actions}${across}. ${history}, ${status}.`,
    actions && `${name}: AWS managed IAM policy naming ${actions}. ${history}, ${status}.`,
    `${name}: AWS managed IAM policy, ${history}, ${status}.`,
  ].filter(Boolean) as string[];
  return candidates.find((c) => c.length <= 158) ?? candidates[candidates.length - 1];
}

export async function generateMetadata(props: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const policyName = decodeURIComponent(params.name);
  const policy = loadPolicy(policyName);
  const policyPath = encodeURIComponent(policyName);
  return pageMetadata({
    title: `${policyName} - AWS Managed IAM Policy`,
    description: describe(policy),
    path: `/policies/${policyPath}`,
    image: {
      url: `https://iamtrail.com/policies/${policyPath}/opengraph.png`,
      width: policyOgSize.width,
      height: policyOgSize.height,
      alt: `IAMTrail - ${policyName} managed policy preview`,
    },
  });
}

export default async function PolicyDetailPage(props: {
  params: Promise<{ name: string }>;
}) {
  const params = await props.params;
  const policyName = decodeURIComponent(params.name);
  const policy = loadPolicy(policyName);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Policies", path: "/policies" },
              { name: policyName, path: `/policies/${encodeURIComponent(policyName)}` },
            ]),
          ),
        }}
      />
      <PolicyDetailClient policy={policy} />
    </>
  );
}
