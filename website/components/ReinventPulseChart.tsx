"use client";

interface ReinventPulseEntry {
  year: string;
  changes: number;
  newPolicies: number;
}

interface ReinventPulseChartProps {
  reinventPulse: ReinventPulseEntry[];
}

export default function ReinventPulseChart({
  reinventPulse,
}: ReinventPulseChartProps) {
  const filtered = (reinventPulse || []).filter((r) => r.year !== "2019");
  if (filtered.length === 0) return null;

  const maxChanges = Math.max(...filtered.map((r) => r.changes), 1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        re:Invent Pulse
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        Policy changes during the Nov 15 - Dec 15 window each year
      </p>
      <div className="flex items-end gap-2 sm:gap-3 h-40 sm:h-48">
        {filtered.map((entry) => {
          const totalH = Math.max((entry.changes / maxChanges) * 100, 3);
          const newH =
            entry.changes > 0
              ? (entry.newPolicies / entry.changes) * totalH
              : 0;
          const updateH = totalH - newH;

          return (
            <div
              key={entry.year}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 mb-1 hidden sm:block tabular-nums">
                {entry.changes}
              </span>
              <div
                className="w-full flex flex-col justify-end group relative cursor-default"
                style={{ height: `${totalH}%` }}
              >
                <div
                  className="w-full bg-amber-500 dark:bg-amber-400 rounded-t-sm"
                  style={{ height: `${updateH}%`, minHeight: updateH > 0 ? "2px" : 0 }}
                />
                {newH > 0 && (
                  <div
                    className="w-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ height: `${newH}%`, minHeight: "2px" }}
                  />
                )}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-mono px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {entry.changes} changes, {entry.newPolicies} new
                </div>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1.5 tabular-nums">
                {entry.year.slice(-2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
          Updates
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-zinc-400 dark:bg-zinc-500" />
          New launches
        </span>
      </div>
    </div>
  );
}
