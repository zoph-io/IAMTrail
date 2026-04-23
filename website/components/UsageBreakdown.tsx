type BreakdownItem = { label: string; count: number; color?: string };

interface UsageBreakdownProps {
  title: string;
  description: string;
  footnote?: string;
  items: BreakdownItem[];
}

const DEFAULT_COLORS = [
  "bg-zinc-500 dark:bg-zinc-500",
  "bg-red-600 dark:bg-red-500",
  "bg-amber-500 dark:bg-amber-500",
  "bg-emerald-600 dark:bg-emerald-500",
  "bg-blue-600 dark:bg-blue-500",
];

export default function UsageBreakdown({
  title,
  description,
  footnote,
  items,
}: UsageBreakdownProps) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">{description}</p>
      <div className="space-y-2">
        {items.map((b, i) => {
          const color = b.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const widthPct = Math.max((b.count / max) * 100, b.count > 0 ? 4 : 0);
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-32 sm:w-40 text-right text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 truncate" title={b.label}>
                {b.label}
              </span>
              <div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${color}`}
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
      {total > 0 && footnote && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{footnote}</p>
      )}
    </div>
  );
}
