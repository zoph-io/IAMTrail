"use client";

import Link from "next/link";

interface TopVersionPolicy {
  name: string;
  version: string;
  versionNumber: number;
}

interface VersionDistributionChartProps {
  versionDistribution: Record<string, number>;
  topVersionPolicies: TopVersionPolicy[];
}

export default function VersionDistributionChart({
  versionDistribution,
  topVersionPolicies,
}: VersionDistributionChartProps) {
  const buckets: { label: string; count: number }[] = [];
  const dist = { ...versionDistribution };
  delete dist["unknown"];

  for (let i = 1; i <= 5; i++) {
    buckets.push({ label: `v${i}`, count: dist[`v${i}`] || 0 });
  }

  let range6_10 = 0;
  for (let i = 6; i <= 10; i++) range6_10 += dist[`v${i}`] || 0;
  buckets.push({ label: "v6-10", count: range6_10 });

  let range11_20 = 0;
  for (let i = 11; i <= 20; i++) range11_20 += dist[`v${i}`] || 0;
  buckets.push({ label: "v11-20", count: range11_20 });

  let range21plus = 0;
  for (const [key, val] of Object.entries(dist)) {
    const num = parseInt(key.replace("v", ""), 10);
    if (num > 20) range21plus += val;
  }
  buckets.push({ label: "v21+", count: range21plus });

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const totalPolicies = buckets.reduce((s, b) => s + b.count, 0);
  const v1Count = dist["v1"] || 0;
  const v1Pct = totalPolicies > 0 ? Math.round((v1Count / totalPolicies) * 100) : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        Policy Lifecycle
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
        Current version distribution across all policies
      </p>

      <div className="space-y-2">
        {buckets.map((b) => {
          const widthPct = Math.max((b.count / maxCount) * 100, 1);
          const isV1 = b.label === "v1";
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-12 text-right text-xs font-mono text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                {b.label}
              </span>
              <div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${
                    isV1
                      ? "bg-zinc-400 dark:bg-zinc-500"
                      : "bg-red-600 dark:bg-red-500"
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 tabular-nums flex-shrink-0">
                {b.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-700">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
          <strong className="text-zinc-900 dark:text-white">{v1Pct}%</strong>{" "}
          of policies ({v1Count.toLocaleString()}) are still at v1 - created
          once and never updated.
        </p>
      </div>

      {topVersionPolicies && topVersionPolicies.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
            Most revised
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {topVersionPolicies.slice(0, 5).map((p) => (
              <Link
                key={p.name}
                href={`/policies/${encodeURIComponent(p.name)}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800"
              >
                <span className="truncate max-w-[120px]">{p.name}</span>
                <span className="font-semibold flex-shrink-0">{p.version}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
