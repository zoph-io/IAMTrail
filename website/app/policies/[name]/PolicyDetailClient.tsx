"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";

interface PolicyVersion {
  hash: string;
  date: string;
  message: string;
  author: string;
}

interface PolicyData {
  name: string;
  createDate: string | null;
  versionId: string | null;
  lastModified: string;
  versionsCount: number;
  size: number;
  actionCount?: number;
  history: PolicyVersion[];
  content: any;
}

export default function PolicyDetailClient({
  policyName,
}: {
  policyName: string;
}) {
  const decodedName = decodeURIComponent(policyName);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    async function loadPolicy() {
      try {
        const response = await fetch(
          `/data/${encodeURIComponent(decodedName)}.json`
        );
        if (!response.ok) {
          throw new Error("Policy not found");
        }
        const data = await response.json();
        setPolicy(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load policy");
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, [decodedName]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-300 border-t-red-600 rounded-full mb-4"></div>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm font-mono">Loading policy...</p>
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
          Policy Not Found
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {error || "The requested policy could not be found."}
        </p>
        <Link
          href="/policies"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded font-mono text-sm hover:bg-red-700 transition-colors"
        >
          Back to Policies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        <Link
          href="/"
          className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Home
        </Link>
        <span>/</span>
        <Link
          href="/policies"
          className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Policies
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-white truncate">
          {policy.name}
        </span>
      </nav>

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-4">
          {policy.name}
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
              Last Modified
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {getRelativeTime(policy.lastModified)}
            </p>
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {formatDate(policy.lastModified)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
              Version
            </p>
            <p className="text-sm font-medium font-mono text-zinc-900 dark:text-white">
              {policy.versionId || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
              Total Versions
            </p>
            <p className="text-sm font-medium font-mono text-zinc-900 dark:text-white">
              {policy.versionsCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
              Created
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {policy.createDate
                ? new Date(policy.createDate).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          {policy.actionCount !== undefined && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
                Actions
              </p>
              <p className="text-sm font-medium font-mono text-zinc-900 dark:text-white">
                {policy.actionCount}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Policy Content */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            Policy Document
          </h2>
          <a
            href={`https://github.com/zoph-io/IAMTrail/blob/master/policies/${policy.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-red-600 dark:text-red-400 hover:underline"
          >
            View on GitHub
          </a>
        </div>
        <div className="overflow-hidden">
          <SyntaxHighlighter
            language="json"
            style={isDark ? vscDarkPlus : vs}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: "0.8rem",
              lineHeight: "1.5",
              background: isDark ? "#18181b" : "#fafafa",
            }}
            lineNumberStyle={{
              minWidth: "3.5em",
              paddingRight: "1em",
              color: isDark ? "#52525b" : "#a1a1aa",
              userSelect: "none",
              textAlign: "right",
            }}
            codeTagProps={{
              style: {
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              },
            }}
          >
            {JSON.stringify(policy.content, null, 2)}
          </SyntaxHighlighter>
        </div>
      </div>

      {/* Version History */}
      {policy.history && policy.history.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
              Version History ({policy.versionsCount} total)
            </h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {policy.history.map((version) => (
              <div
                key={version.hash}
                className="px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                        {version.hash.substring(0, 7)}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {version.author}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">
                        {getRelativeTime(version.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-900 dark:text-white">
                      {version.message}
                    </p>
                  </div>
                  <a
                    href={`https://github.com/zoph-io/IAMTrail/commit/${version.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 text-red-600 dark:text-red-400 hover:underline text-xs font-mono"
                  >
                    View diff
                  </a>
                </div>
              </div>
            ))}
          </div>
          {policy.versionsCount > policy.history.length && (
            <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-900 text-center border-t border-zinc-100 dark:border-zinc-800">
              <a
                href={`https://github.com/zoph-io/IAMTrail/commits/master/policies/${policy.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-red-600 dark:text-red-400 hover:underline"
              >
                View all {policy.versionsCount} versions on GitHub
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
