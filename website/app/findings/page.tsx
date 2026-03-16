"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

interface Finding {
  findingType: "ERROR" | "SECURITY_WARNING" | "WARNING" | "SUGGESTION";
  findingDetails: string;
  issueCode: string;
  learnMoreLink: string;
}

interface PolicyFindings {
  name: string;
  findings: Finding[];
}

interface FindingsData {
  lastUpdated: string;
  totalPoliciesAnalyzed: number;
  policiesWithFindings: number;
  byType: Record<string, number>;
  policies: PolicyFindings[];
}

const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; sortOrder: number }
> = {
  ERROR: {
    label: "Error",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    sortOrder: 0,
  },
  SECURITY_WARNING: {
    label: "Security Warning",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    sortOrder: 1,
  },
  WARNING: {
    label: "Warning",
    color: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    sortOrder: 2,
  },
  SUGGESTION: {
    label: "Suggestion",
    color: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-800",
    border: "border-zinc-200 dark:border-zinc-700",
    sortOrder: 3,
  },
};

function SeverityBadge({ type }: { type: string }) {
  const config = SEVERITY_CONFIG[type] || SEVERITY_CONFIG.SUGGESTION;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ${config.bg} ${config.color} border ${config.border}`}
    >
      {config.label}
    </span>
  );
}

export default function FindingsPage() {
  const [data, setData] = useState<FindingsData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFindings() {
      try {
        const response = await fetch("/data/findings.json");
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error("Error loading findings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadFindings();
  }, []);

  const filteredPolicies = useMemo(() => {
    if (!data) return [];

    return data.policies
      .map((policy) => {
        const matchedFindings = policy.findings.filter((f) => {
          const matchesSeverity =
            severityFilter === "ALL" || f.findingType === severityFilter;
          const matchesSearch =
            searchTerm === "" ||
            policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.issueCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.findingDetails.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesSeverity && matchesSearch;
        });
        if (matchedFindings.length === 0) return null;
        return { ...policy, findings: matchedFindings };
      })
      .filter(Boolean) as PolicyFindings[];
  }, [data, searchTerm, severityFilter]);

  const totalFilteredFindings = useMemo(
    () => filteredPolicies.reduce((sum, p) => sum + p.findings.length, 0),
    [filteredPolicies]
  );

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-300 border-t-red-600 rounded-full mb-4"></div>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm font-mono">
          Loading findings...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          No findings data available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
          Policy Validation Findings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
          Using AWS IAM Access Analyzer to validate AWS&apos;s own Managed IAM
          Policies - reviewing the reviewer.
        </p>
        <p className="mt-2 text-xs font-mono text-zinc-400 dark:text-zinc-500">
          Last updated: {data.lastUpdated}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setSeverityFilter(severityFilter === "ERROR" ? "ALL" : "ERROR")}
          className={`bg-white dark:bg-zinc-900 rounded-lg border p-4 text-left transition-all hover:border-red-300 dark:hover:border-red-800 ${
            severityFilter === "ERROR"
              ? "ring-2 ring-red-500 border-red-300 dark:border-red-700"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-red-600 dark:text-red-400">
            Errors
          </p>
          <p className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {data.byType.ERROR || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
            Invalid policy elements
          </p>
        </button>

        <button
          onClick={() =>
            setSeverityFilter(severityFilter === "SECURITY_WARNING" ? "ALL" : "SECURITY_WARNING")
          }
          className={`bg-white dark:bg-zinc-900 rounded-lg border p-4 text-left transition-all hover:border-orange-300 dark:hover:border-orange-800 ${
            severityFilter === "SECURITY_WARNING"
              ? "ring-2 ring-orange-500 border-orange-300 dark:border-orange-700"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-orange-600 dark:text-orange-400">
            Security Warnings
          </p>
          <p className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {data.byType.SECURITY_WARNING || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
            Potential security risks
          </p>
        </button>

        <button
          onClick={() => setSeverityFilter(severityFilter === "WARNING" ? "ALL" : "WARNING")}
          className={`bg-white dark:bg-zinc-900 rounded-lg border p-4 text-left transition-all hover:border-yellow-300 dark:hover:border-yellow-800 ${
            severityFilter === "WARNING"
              ? "ring-2 ring-yellow-500 border-yellow-300 dark:border-yellow-700"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
            Warnings
          </p>
          <p className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {data.byType.WARNING || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
            General policy issues
          </p>
        </button>

        <button
          onClick={() =>
            setSeverityFilter(severityFilter === "SUGGESTION" ? "ALL" : "SUGGESTION")
          }
          className={`bg-white dark:bg-zinc-900 rounded-lg border p-4 text-left transition-all hover:border-zinc-300 dark:hover:border-zinc-600 ${
            severityFilter === "SUGGESTION"
              ? "ring-2 ring-zinc-400 border-zinc-300 dark:border-zinc-600"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Suggestions
          </p>
          <p className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {data.byType.SUGGESTION || 0}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">
            Improvement opportunities
          </p>
        </button>
      </div>

      {/* Overview bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        <span>
          <strong className="text-zinc-900 dark:text-white">
            {data.totalPoliciesAnalyzed.toLocaleString()}
          </strong>{" "}
          policies analyzed
        </span>
        <span>
          <strong className="text-zinc-900 dark:text-white">
            {data.policiesWithFindings}
          </strong>{" "}
          with findings
        </span>
        <span>
          <strong className="text-zinc-900 dark:text-white">
            {Object.values(data.byType).reduce((a, b) => a + b, 0)}
          </strong>{" "}
          total findings
        </span>
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
                placeholder="Search by policy name, issue code, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <select
              className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL">All Severities</option>
              <option value="ERROR">Errors</option>
              <option value="SECURITY_WARNING">Security Warnings</option>
              <option value="WARNING">Warnings</option>
              <option value="SUGGESTION">Suggestions</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Showing {totalFilteredFindings} finding
          {totalFilteredFindings !== 1 ? "s" : ""} across{" "}
          {filteredPolicies.length} polic
          {filteredPolicies.length !== 1 ? "ies" : "y"}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filteredPolicies.map((policy) => (
          <div
            key={policy.name}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <Link
                href={`/policies/${encodeURIComponent(policy.name)}`}
                className="text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline transition-colors"
              >
                {policy.name}
              </Link>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 ml-2 flex-shrink-0">
                {policy.findings.length} finding
                {policy.findings.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {policy.findings
                .sort(
                  (a, b) =>
                    (SEVERITY_CONFIG[a.findingType]?.sortOrder ?? 99) -
                    (SEVERITY_CONFIG[b.findingType]?.sortOrder ?? 99)
                )
                .map((finding, idx) => (
                  <div key={idx} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <SeverityBadge type={finding.findingType} />
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {finding.issueCode}
                      </code>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {finding.findingDetails}
                    </p>
                    {finding.learnMoreLink && (
                      <a
                        href={finding.learnMoreLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-2 text-xs font-mono text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline transition-colors"
                      >
                        Learn more
                        <svg
                          className="w-3 h-3 ml-1"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {filteredPolicies.length === 0 && (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold font-mono text-zinc-900 dark:text-white mb-2">
            No findings match your filters
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search term or severity filter
          </p>
        </div>
      )}
    </div>
  );
}
