import { type ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}

export default function StatsCard({
  title,
  value,
  description,
  icon,
}: StatsCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:border-red-300 dark:hover:border-red-800 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500 truncate">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-red-500/40 dark:text-red-400/30 flex-shrink-0">{icon}</div>
        )}
      </div>
    </div>
  );
}
