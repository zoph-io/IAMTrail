import { ExternalLink } from "lucide-react";

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

export default function EndpointChangeFeed({
  changes,
}: {
  changes: ChangeRecord[];
}) {
  if (changes.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No changes detected yet. Endpoint monitoring runs every 6 hours.
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 font-mono">
          Tracking botocore/data/endpoints.json for new regions, services, and
          endpoint expansions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {changes.map((record, idx) => (
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
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                  {change.description}
                </p>
                {change.new_regions && change.new_regions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {change.new_regions.map((r) => (
                      <span
                        key={r}
                        className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
