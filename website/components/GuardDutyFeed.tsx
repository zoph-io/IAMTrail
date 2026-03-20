"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

interface Announcement {
  type: string;
  detected_at: string;
  description: string;
  short_description: string;
  link: string;
  gist_url?: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  NEW_FINDINGS: {
    label: "New Finding",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
  },
  UPDATED_FINDINGS: {
    label: "Updated Finding",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
  },
  NEW_FEATURES: {
    label: "New Feature",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  NEW_REGION: {
    label: "New Region",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  GENERAL: {
    label: "General",
    color: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-800",
    border: "border-zinc-200 dark:border-zinc-700",
  },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG);

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.GENERAL;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${config.bg} ${config.color} border ${config.border}`}
    >
      {config.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(iso: string) {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function GuardDutyFeed({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = activeFilter
    ? announcements.filter((a) => a.type === activeFilter)
    : announcements;

  const typeCounts: Record<string, number> = {};
  for (const a of announcements) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No announcements recorded yet. The monitor is active and listening
          for GuardDuty SNS notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter(null)}
          className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
            activeFilter === null
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
              : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
          }`}
        >
          All ({announcements.length})
        </button>
        {ALL_TYPES.filter((t) => typeCounts[t]).map((type) => {
          const config = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() =>
                setActiveFilter(activeFilter === type ? null : type)
              }
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                activeFilter === type
                  ? `${config.bg} ${config.color} ${config.border}`
                  : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
              }`}
            >
              {config.label} ({typeCounts[type]})
            </button>
          );
        })}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {filtered.map((ann, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TypeBadge type={ann.type} />
                <span className="text-sm font-mono text-zinc-900 dark:text-white">
                  {formatDate(ann.detected_at)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatRelativeTime(ann.detected_at)}
                </span>
              </div>
              {ann.link && (
                <a
                  href={ann.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Details
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="px-5 py-3">
              {ann.short_description && (
                <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                  {ann.short_description}
                </p>
              )}
              {ann.description &&
                ann.description !== ann.short_description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                    {ann.description}
                  </p>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
