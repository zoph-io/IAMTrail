"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";

interface Change {
  type: string;
  partition: string;
  id: string;
  description: string;
  service?: string;
  new_regions?: string[];
  removed_regions?: string[];
  endpoint_count?: number;
}

interface ChangeRecord {
  detected_at: string;
  botocore_commit?: string;
  botocore_commit_url?: string | null;
  summary: string;
  changes: Change[];
}

const CHANGE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  new_region: {
    label: "New Region",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  removed_region: {
    label: "Removed Region",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
  },
  new_service: {
    label: "New Service",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  removed_service: {
    label: "Removed Service",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
  },
  service_expansion: {
    label: "Service Expansion",
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  service_contraction: {
    label: "Service Contraction",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  new_partition: {
    label: "New Partition",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
  },
  region_updated: {
    label: "Region Updated",
    color: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-800",
    border: "border-zinc-200 dark:border-zinc-700",
  },
};

function ChangeTypeBadge({ type }: { type: string }) {
  const config = CHANGE_TYPE_CONFIG[type] || CHANGE_TYPE_CONFIG.region_updated;
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

const PAGE_SIZE = 30;

export default function EndpointChangeFeed({
  changes,
}: {
  changes: ChangeRecord[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [partitionFilter, setPartitionFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of changes) {
      for (const c of r.changes) types.add(c.type);
    }
    return [...types].sort();
  }, [changes]);

  const availablePartitions = useMemo(() => {
    const parts = new Set<string>();
    for (const r of changes) {
      for (const c of r.changes) parts.add(c.partition);
    }
    return [...parts].sort();
  }, [changes]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return changes
      .map((record) => {
        const matchingChanges = record.changes.filter((c) => {
          if (typeFilter !== "all" && c.type !== typeFilter) return false;
          if (partitionFilter !== "all" && c.partition !== partitionFilter)
            return false;
          if (q) {
            const haystack = [
              c.service || "",
              c.id,
              c.description,
              ...(c.new_regions || []),
              ...(c.removed_regions || []),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        });
        if (matchingChanges.length === 0) return null;
        return { ...record, changes: matchingChanges };
      })
      .filter(Boolean) as ChangeRecord[];
  }, [changes, searchQuery, typeFilter, partitionFilter]);

  const hasActiveFilters =
    searchQuery !== "" || typeFilter !== "all" || partitionFilter !== "all";
  const visible = filtered.slice(0, visibleCount);
  const totalItems = filtered.reduce((s, r) => s + r.changes.length, 0);

  if (changes.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No changes detected yet. Endpoint monitoring runs every 6 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filter bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search services, regions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none font-mono"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              hasActiveFilters
                ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filters
            {showFilters ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Type
              </span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none"
              >
                <option value="all">All types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {CHANGE_TYPE_CONFIG[t]?.label || t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Partition
              </span>
              <select
                value={partitionFilter}
                onChange={(e) => {
                  setPartitionFilter(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none"
              >
                <option value="all">All partitions</option>
                {availablePartitions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setPartitionFilter("all");
                  setVisibleCount(PAGE_SIZE);
                }}
                className="text-xs font-mono text-red-600 dark:text-red-400 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs font-mono text-zinc-400 dark:text-zinc-500 px-1">
        {hasActiveFilters
          ? `${totalItems} change${totalItems !== 1 ? "s" : ""} in ${filtered.length} record${filtered.length !== 1 ? "s" : ""} (filtered)`
          : `${totalItems} changes across ${changes.length} records`}
      </p>

      {/* Feed */}
      <div className="space-y-3">
        {visible.map((record, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">
                  {formatDate(record.detected_at)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {formatRelativeTime(record.detected_at)}
                </span>
              </div>
              {record.botocore_commit_url && (
                <a
                  href={record.botocore_commit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  {record.botocore_commit?.slice(0, 7) || "commit"}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {record.changes.map((change, cIdx) => (
                <div key={cIdx} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <ChangeTypeBadge type={change.type} />
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {change.partition}
                    </code>
                    {change.service && (
                      <code className="text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                        {change.service}
                      </code>
                    )}
                  </div>
                  {change.new_regions && change.new_regions.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {change.new_regions.map((r) => (
                        <span
                          key={r}
                          className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : change.removed_regions &&
                    change.removed_regions.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {change.removed_regions.map((r) => (
                        <span
                          key={r}
                          className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                      {change.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {visibleCount < filtered.length && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="inline-flex items-center gap-1 px-4 py-2 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Load more ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
