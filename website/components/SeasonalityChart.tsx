"use client";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface SeasonalityChartProps {
  changesByMonth: Record<string, number>;
}

export default function SeasonalityChart({
  changesByMonth,
}: SeasonalityChartProps) {
  const months = MONTH_LABELS.map((label, i) => {
    const key = String(i + 1).padStart(2, "0");
    return { label, count: changesByMonth[key] || 0, month: i + 1 };
  });

  const maxCount = Math.max(...months.map((m) => m.count), 1);
  const avg = months.reduce((s, m) => s + m.count, 0) / 12;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        Monthly Seasonality
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Policy change volume by calendar month across all years
      </p>
      <div className="flex items-end gap-1 sm:gap-2 h-48 sm:h-56">
        {months.map((m) => {
          const heightPct = Math.max((m.count / maxCount) * 100, 2);
          const isReinvent = m.month === 11 || m.month === 12;
          return (
            <div
              key={m.label}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 mb-1 hidden sm:block">
                {m.count}
              </span>
              <div
                className={`w-full rounded-t-sm transition-colors cursor-default group relative ${
                  isReinvent
                    ? "bg-amber-500 dark:bg-amber-400 hover:bg-amber-600 dark:hover:bg-amber-300"
                    : "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400"
                }`}
                style={{ height: `${heightPct}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-mono px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none sm:hidden">
                  {m.count}
                </div>
              </div>
              <span
                className={`text-[10px] sm:text-xs font-mono mt-1.5 tabular-nums ${
                  isReinvent
                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
        <span>
          re:Invent season (Nov-Dec) -{" "}
          <strong className="text-zinc-700 dark:text-zinc-300">
            {Math.round(
              ((months[10].count + months[11].count) / 2 / avg) * 100 -
                100,
            )}
            % above average
          </strong>
        </span>
      </div>
    </div>
  );
}
