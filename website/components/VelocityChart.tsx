"use client";

interface VelocityEntry {
  year: string;
  total: number;
  newPolicies: number;
  updates: number;
}

interface VelocityChartProps {
  yearlyVelocity: VelocityEntry[];
  bulkDaysExcluded?: string[];
}

export default function VelocityChart({
  yearlyVelocity,
  bulkDaysExcluded,
}: VelocityChartProps) {
  const filtered = (yearlyVelocity || []).filter((v) => v.year !== "2019");
  if (filtered.length === 0) return null;

  const maxTotal = Math.max(...filtered.map((v) => v.total), 1);
  const totalAll = filtered.reduce((s, v) => s + v.total, 0);
  const peak = filtered.reduce((a, b) => (b.total > a.total ? b : a));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        Year-over-Year Velocity
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Total policy commits per year - new launches vs. updates
      </p>

      <div className="flex items-end gap-2 sm:gap-3 h-48 sm:h-56">
        {filtered.map((entry) => {
          const totalH = Math.max((entry.total / maxTotal) * 100, 3);
          const newH =
            entry.total > 0
              ? (entry.newPolicies / entry.total) * totalH
              : 0;
          const updateH = totalH - newH;
          const isPeak = entry.year === peak.year;

          return (
            <div
              key={entry.year}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              <span
                className={`text-xs font-mono font-medium mb-1 hidden sm:block tabular-nums ${
                  isPeak
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {entry.total}
              </span>
              <div
                className="w-full flex flex-col justify-end cursor-default group relative"
                style={{ height: `${totalH}%` }}
              >
                <div
                  className={`w-full rounded-t-sm ${
                    isPeak
                      ? "bg-red-700 dark:bg-red-500"
                      : "bg-red-600 dark:bg-red-500"
                  }`}
                  style={{
                    height: `${updateH}%`,
                    minHeight: updateH > 0 ? "2px" : 0,
                  }}
                />
                {newH > 0 && (
                  <div
                    className="w-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ height: `${newH}%`, minHeight: "2px" }}
                  />
                )}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-mono px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {entry.total} total ({entry.newPolicies} new,{" "}
                  {entry.updates} updates)
                </div>
              </div>
              <span
                className={`text-[10px] sm:text-xs font-mono mt-1.5 tabular-nums ${
                  isPeak
                    ? "text-red-600 dark:text-red-400 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {entry.year.slice(-2)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-600 dark:bg-red-500" />
          Updates
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-zinc-400 dark:bg-zinc-500" />
          New launches
        </span>
        <span className="ml-auto">
          <strong className="text-zinc-700 dark:text-zinc-300">
            {totalAll.toLocaleString()}
          </strong>{" "}
          total commits tracked
        </span>
      </div>

      {bulkDaysExcluded && bulkDaysExcluded.length > 0 && (
        <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
          Excludes {bulkDaysExcluded.length} bulk-reformat day(s) where
          detection logic changes caused false-positive diffs.
        </p>
      )}
    </div>
  );
}
