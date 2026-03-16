"use client";

interface PolicyAgeChartProps {
  policiesByYear: Record<string, number>;
}

export default function PolicyAgeChart({
  policiesByYear,
}: PolicyAgeChartProps) {
  const years = Object.keys(policiesByYear)
    .filter((y) => y !== "2019")
    .sort();
  const counts = years.map((y) => policiesByYear[y]);
  const maxCount = Math.max(...counts, 1);

  if (years.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        Policy Creation by Year
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Number of AWS managed policies first tracked each year
      </p>
      <div className="flex items-end gap-1 sm:gap-2 h-48 sm:h-56">
        {years.map((year) => {
          const count = policiesByYear[year];
          const heightPct = Math.max((count / maxCount) * 100, 2);
          return (
            <div
              key={year}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 mb-1 hidden sm:block">
                {count}
              </span>
              <div
                className="w-full rounded-sm bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400 transition-colors cursor-default group relative"
                style={{ height: `${heightPct}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none sm:hidden">
                  {count}
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                {year.slice(-2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-mono text-zinc-400 dark:text-zinc-500">
        <span>{years[0]}</span>
        <span>
          {counts.reduce((a, b) => a + b, 0).toLocaleString()} total policies
        </span>
        <span>{years[years.length - 1]}</span>
      </div>
    </div>
  );
}
