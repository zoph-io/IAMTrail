import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Trash2,
  TrendingUp,
  Ruler,
  Layers,
  Key,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import PolicyList from "@/components/PolicyList";
import PolicyAgeChart from "@/components/PolicyAgeChart";
import SeasonalityChart from "@/components/SeasonalityChart";
import ReinventPulseChart from "@/components/ReinventPulseChart";
import VersionDistributionChart from "@/components/VersionDistributionChart";
import VelocityChart from "@/components/VelocityChart";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "AWS Managed IAM Policies by the Numbers",
  description:
    "Charts and rankings across every AWS Managed IAM Policy since 2019: change velocity, seasonality, the re:Invent pulse, version distribution, and the largest and most active policies.",
  alternates: {
    canonical: "https://iamtrail.com/stats",
  },
};

async function getSummaryData() {
  try {
    const fs = require("fs");
    const path = require("path");
    const dataPath = path.join(process.cwd(), "public/data/summary.json");
    if (!fs.existsSync(dataPath)) return null;
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (error) {
    console.error("Error loading summary data:", error);
    return null;
  }
}

export default async function StatsPage() {
  const summaryData = await getSummaryData();

  if (!summaryData) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">No data available.</p>
      </div>
    );
  }

  const { stats, deprecated } = summaryData;
  const deprecatedCount = Object.keys(deprecated).length;

  return (
    <div className="space-y-6">
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
          Stats
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
          The whole archive in numbers: how often AWS changes its managed
          policies, when, and which ones.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/policies">
          <StatsCard
            title="Total Policies"
            value={stats.totalPolicies.toLocaleString()}
            description="Active AWS Managed Policies"
            icon={<FileText className="w-8 h-8" />}
          />
        </Link>
        <Link href="/brand-new">
          <StatsCard
            title="Brand New (v1)"
            value={stats.brandNew?.length || 0}
            description="New AWS services/features"
            icon={<Sparkles className="w-8 h-8" />}
          />
        </Link>
        <Link href="/deprecated">
          <StatsCard
            title="Deprecated"
            value={deprecatedCount.toLocaleString()}
            description="Removed from AWS"
            icon={<Trash2 className="w-8 h-8" />}
          />
        </Link>
        <Link href="/most-active">
          <StatsCard
            title="Most Active"
            value={stats.mostModified[0]?.versionsCount || 0}
            description={`${stats.mostModified[0]?.name.substring(0, 20)}...`}
            icon={<TrendingUp className="w-8 h-8" />}
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {stats.policiesByYear && (
            <PolicyAgeChart policiesByYear={stats.policiesByYear} />
          )}
        </div>
        <div className="space-y-4">
          <Link href="/largest-policies">
            <StatsCard
              title="Largest Policy"
              value={`${stats.largestByActionCount?.[0]?.actionCount || 0} actions`}
              description={
                stats.largestByActionCount?.[0]?.name.substring(0, 25) +
                  "..." || "N/A"
              }
              icon={<Ruler className="w-8 h-8" />}
            />
          </Link>
          <Link href="/service-growth">
            <StatsCard
              title="AWS Services Tracked"
              value={
                stats.serviceGrowth
                  ? Object.values(
                      stats.serviceGrowth as Record<string, string[]>,
                    ).reduce((sum, arr) => sum + arr.length, 0)
                  : 0
              }
              description="IAM service namespaces over time"
              icon={<Layers className="w-8 h-8" />}
            />
          </Link>
          <StatsCard
            title="IAM Actions (literals)"
            value={
              typeof stats.uniqueLiteralActionCount === "number"
                ? stats.uniqueLiteralActionCount.toLocaleString()
                : "~14,055"
            }
            description="Distinct action strings in managed policies (no wildcards)"
            icon={<Key className="w-8 h-8" />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.yearlyVelocity && (
          <VelocityChart
            yearlyVelocity={stats.yearlyVelocity}
            bulkDaysExcluded={stats.bulkDaysExcluded}
          />
        )}
        {stats.versionDistribution && (
          <VersionDistributionChart
            versionDistribution={stats.versionDistribution}
            topVersionPolicies={stats.topVersionPolicies || []}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {stats.changesByMonth && (
            <SeasonalityChart changesByMonth={stats.changesByMonth} />
          )}
        </div>
        {stats.reinventPulse && (
          <ReinventPulseChart reinventPulse={stats.reinventPulse} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PolicyList
          title="Recently Updated"
          policies={stats.recentlyUpdated}
          showVersions={true}
        />
        {stats.volatileThisYear && stats.volatileThisYear.length > 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
                Most Volatile (Trailing 12 Months)
              </h3>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stats.volatileThisYear.map(
                (p: { name: string; changesThisYear: number }) => (
                  <Link
                    key={p.name}
                    href={`/policies/${encodeURIComponent(p.name)}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-sm text-zinc-900 dark:text-white truncate mr-3">
                      {p.name}
                    </span>
                    <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {p.changesThisYear} changes
                    </span>
                  </Link>
                ),
              )}
            </div>
          </div>
        ) : (
          <PolicyList
            title="Newest Policies"
            policies={stats.newest}
            showVersions={false}
          />
        )}
      </div>

      {stats.volatileThisYear && stats.volatileThisYear.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PolicyList
            title="Newest Policies"
            policies={stats.newest}
            showVersions={false}
          />
          <PolicyList
            title="Oldest Policies"
            policies={stats.oldest}
            showVersions={false}
          />
        </div>
      )}

      <RelatedPages current="/stats" />
    </div>
  );
}
