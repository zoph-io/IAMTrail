import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Policy {
  name: string;
  lastModified: string;
  createDate: string | null;
  versionsCount: number;
  versionId: string | null;
}

interface PolicyListProps {
  title: string;
  policies: Policy[];
  showVersions?: boolean;
  showCreateDatePrimary?: boolean;
}

export default function PolicyList({
  title,
  policies,
  showVersions = true,
  showCreateDatePrimary = false,
}: PolicyListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    }

    const months =
      (now.getFullYear() - date.getFullYear()) * 12 +
      (now.getMonth() - date.getMonth());
    if (months < 12) {
      return `${months} month${months !== 1 ? "s" : ""} ago`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? "s" : ""} ago`;
    }
    return `${years}y ${remainingMonths}m ago`;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {policies.length === 0 ? (
          <div className="px-5 py-8 text-center text-zinc-500">
            No policies found
          </div>
        ) : (
          policies.map((policy) => (
            <Link
              key={policy.name}
              href={`/policies/${encodeURIComponent(policy.name)}`}
              className="block px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {policy.name}
                  </p>
                  <div className="mt-0.5 flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {showCreateDatePrimary && policy.createDate ? (
                      <>
                        <span>Created {formatDate(policy.createDate)}</span>
                        <span className="hidden sm:inline">
                          / Updated {getRelativeTime(policy.lastModified)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{getRelativeTime(policy.lastModified)}</span>
                        {showVersions && (
                          <span>
                            / {policy.versionsCount} version
                            {policy.versionsCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {policy.createDate && (
                          <span className="hidden sm:inline">
                            / Created {formatDate(policy.createDate)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="ml-4 w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
