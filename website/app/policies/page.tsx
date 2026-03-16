"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

interface Policy {
  name: string;
  lastModified: string;
  createDate: string | null;
  versionsCount: number;
  versionId: string | null;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "modified" | "versions">(
    "modified"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPolicies() {
      try {
        const response = await fetch("/data/summary.json");
        const data = await response.json();
        setPolicies(data.policies);
      } catch (error) {
        console.error("Error loading policies:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPolicies();
  }, []);

  const filteredAndSortedPolicies = useMemo(() => {
    let filtered = policies.filter((policy) =>
      policy.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "versions":
          return b.versionsCount - a.versionsCount;
        case "modified":
        default:
          return (
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
          );
      }
    });
  }, [policies, searchTerm, sortBy]);

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
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;

    const months =
      (now.getFullYear() - date.getFullYear()) * 12 +
      (now.getMonth() - date.getMonth());
    if (months < 12) return `${months}mo ago`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years}y ago`;
    return `${years}y ${remainingMonths}m ago`;
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-300 border-t-red-600 rounded-full mb-4"></div>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm font-mono">
          Loading policies...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-1">
          All Policies
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Browse and search {policies.length} AWS Managed IAM Policies
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-zinc-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono"
                placeholder="Search policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="modified">Recently Modified</option>
              <option value="name">Name (A-Z)</option>
              <option value="versions">Most Versions</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Showing {filteredAndSortedPolicies.length} of {policies.length}{" "}
          policies
        </div>
      </div>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAndSortedPolicies.map((policy) => (
          <Link
            key={policy.name}
            href={`/policies/${encodeURIComponent(policy.name)}`}
            className="group bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-sm text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2">
                {policy.name}
              </h3>
              <svg
                className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 ml-2 group-hover:text-red-500 transition-colors"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              <div className="flex items-center justify-between">
                <span>Last modified</span>
                <span className="font-medium">
                  {getRelativeTime(policy.lastModified)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Versions</span>
                <span className="font-medium">{policy.versionsCount}</span>
              </div>
              {policy.createDate && (
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span className="font-medium">
                    {formatDate(policy.createDate)}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredAndSortedPolicies.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold font-mono text-zinc-900 dark:text-white mb-2">
            No policies found
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search term
          </p>
        </div>
      )}
    </div>
  );
}
