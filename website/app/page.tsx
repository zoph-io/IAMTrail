import ChangeCard from "@/components/ChangeCard";
import RelatedPages from "@/components/RelatedPages";
import {
  changeMatters,
  changeRank,
  plural,
  type ChangesFile,
} from "@/lib/changes";
import RelativeDay from "@/components/RelativeDay";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History, Radar } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  absoluteTitle: "IAMTrail - AWS Managed IAM Policy Changes Archive (Unofficial)",
  description:
    "Every AWS Managed IAM Policy change since 2019, with full version history and diffs, never-before-seen actions and new AWS services, checked every hour.",
  path: "/",
});

const WEEK_MS = 7 * 86_400_000;
const MAX_WEEK_CARDS = 8;
const MAX_SERVICES = 6;

type DiscoveredService = {
  prefix: string;
  firstSeen: string;
  firstPolicy: string;
  actionCount: number;
};

function readJson(relativePath: string) {
  try {
    const fs = require("fs");
    const path = require("path");
    const dataPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(dataPath)) return null;
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (error) {
    console.error(`Error loading ${relativePath}:`, error);
    return null;
  }
}

/**
 * The last seven days of changes, measured from the build rather than the
 * visitor's clock, since the page is static. The deploy runs daily on its own
 * cron so the window keeps moving through a quiet week.
 */
function getWeek(file: ChangesFile | null) {
  if (!file) return null;
  const asOf = new Date(file.generatedAt);
  const cutoff = asOf.getTime() - WEEK_MS;
  const inWeek = file.changes.filter((c) => new Date(c.date).getTime() >= cutoff);
  // changes.json is capped, so a bulk week can run past its oldest entry, and
  // the count is then a floor rather than the total.
  const oldest = file.changes[file.changes.length - 1];
  const truncated =
    inWeek.length === file.changes.length &&
    !!oldest &&
    new Date(oldest.date).getTime() > cutoff;
  const mattering = inWeek
    .filter(changeMatters)
    .sort((a, b) => changeRank(a) - changeRank(b) || b.date.localeCompare(a.date));
  return { asOf, inWeek, mattering, truncated };
}

export default async function Home() {
  const summaryData = readJson("public/data/summary.json");
  const week = getWeek(readJson("public/data/changes.json"));
  const discoveries = readJson("public/data/discoveries.json");
  const serviceNames: Record<string, string> =
    readJson("../data/iam-metadata.json")?.serviceNames ?? {};

  if (!summaryData) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 font-mono">
          No Data Available
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Run{" "}
          <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-sm">
            npm run generate-data
          </code>{" "}
          to generate the policy data.
        </p>
      </div>
    );
  }

  // generate-data writes all three together, so one missing means a broken
  // build, which must not ship a homepage that looks like a quiet week.
  if (!week || !discoveries) {
    throw new Error(
      "public/data/changes.json or discoveries.json is missing: run npm run generate-data",
    );
  }

  const { stats } = summaryData;
  const services: DiscoveredService[] = (discoveries?.services ?? []).slice(0, MAX_SERVICES);
  const routine = week.inWeek.length - week.mattering.length;
  const asOfLabel = week.asOf.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="py-12 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-extrabold font-mono text-zinc-900 dark:text-white tracking-tight">
              IAMTrail
            </h1>
            <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded">
              Unofficial
            </span>
          </div>
          <p className="text-lg md:text-xl text-zinc-900 dark:text-white leading-relaxed">
            AWS silently updates Managed IAM policies all the time.
            <br />
            <span className="text-red-600 dark:text-red-400 font-semibold">We archive every published version.</span>
          </p>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Full version history and diffs for{" "}
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{stats.totalPolicies}</span>{" "}
            AWS Managed IAM Policies, archived since 2019.
            <span className="text-zinc-300 dark:text-zinc-700"> | </span>
            A service by{" "}
            <a
              href="https://zoph.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              zoph.io
            </a>
          </p>
        </div>
      </div>

      {/* This week: changes that matter */}
      <section className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center space-x-3">
            <History className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <div>
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                This week: changes that matter
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                New AWS services, never-before-seen actions, permissions
                management, new and removed policies. Last 7 days as of{" "}
                {asOfLabel}.
              </p>
            </div>
          </div>
        </div>

        {week.inWeek.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            No policy changes recorded in the last 7 days.
          </p>
        ) : week.mattering.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            {plural(week.inWeek.length, "routine change")}
            {week.truncated ? " or more" : ""}. None added a new AWS service, a
            never-before-seen action or a permissions management action, and no
            policy was created or removed.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {week.mattering.slice(0, MAX_WEEK_CARDS).map((change) => (
              <ChangeCard
                key={`${change.sha}:${change.policyName}`}
                change={change}
                compact
              />
            ))}
          </div>
        )}

        {week.inWeek.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {plural(week.mattering.length, "change")} that{" "}
              {week.mattering.length === 1 ? "matters" : "matter"}
              {week.mattering.length > MAX_WEEK_CARDS
                ? ` (${MAX_WEEK_CARDS} shown)`
                : ""}
              , {plural(routine, "routine change")}
              {week.truncated ? " or more" : ""}
            </span>
            <Link
              href="/changes"
              className="inline-flex items-center gap-1 text-sm font-medium font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              View all changes
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* New AWS services spotted */}
      <section className="border border-red-200 dark:border-red-900/50 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
          <div className="flex items-center space-x-3">
            <Radar className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-red-700 dark:text-red-400">
                New AWS services spotted
              </h2>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                Service prefixes that appeared in a managed policy for the first
                time, often before AWS announces the service
              </p>
            </div>
          </div>
        </div>
        {services.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            No new AWS service spotted yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
            {services.map((service) => (
              <Link
                key={service.prefix}
                href={`/policies/${encodeURIComponent(service.firstPolicy)}`}
                className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    <code className="font-mono font-semibold">{service.prefix}</code>
                    {serviceNames[service.prefix] ? (
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                        {" "}
                        {serviceNames[service.prefix]}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5 truncate">
                    <RelativeDay date={service.firstSeen} /> / {plural(service.actionCount, "action")} / in{" "}
                    {service.firstPolicy}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 ml-2 group-hover:text-red-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <Link
            href="/discoveries"
            className="inline-flex items-center gap-1 text-sm font-medium font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            All discoveries
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Subscribe CTA */}
      <div className="border border-zinc-900 dark:border-zinc-100 rounded-lg p-6 bg-zinc-900 dark:bg-zinc-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-mono font-semibold text-green-400 dark:text-green-600 uppercase tracking-widest">
                Free - No account needed
              </span>
            </div>
            <h2 className="text-lg font-bold font-mono text-white dark:text-zinc-900">
              Get notified when the policies you use change
            </h2>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">
              Paste the AWS managed policies attached in your account, or track
              them all. Instant, daily or weekly, by email or in a Slack channel.
            </p>
          </div>
          <Link
            href="/subscribe"
            className="px-5 py-2.5 bg-red-600 text-white rounded font-mono font-semibold text-sm hover:bg-red-700 transition-colors flex-shrink-0"
          >
            Subscribe
          </Link>
        </div>
      </div>

      <RelatedPages current="/" />
    </div>
  );
}
