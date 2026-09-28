"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { plural } from "@/lib/changes";
import {
  LEVEL_META,
  RISK_LEVELS,
  SIGNAL_META,
  signalLabel,
  type FindingsFile,
  type RiskLevel,
  type RiskListEntry,
} from "@/lib/risk";

const PAGE = 40;

const CHIP: Record<RiskLevel, string> = {
  critical: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30",
  high: "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30",
  medium: "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
};

function RiskCard({ entry }: { entry: RiskListEntry }) {
  const href = `/policies/${encodeURIComponent(entry.name)}`;
  return (
    <li
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${LEVEL_META[entry.level].accent} rounded-lg px-4 py-3`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={entry.level} />
        <Link
          href={href}
          className="font-mono text-sm font-semibold text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 break-all"
        >
          {entry.name}
        </Link>
      </div>
      <p className="mt-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {entry.headline}
      </p>
      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {entry.reason}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {entry.signals.slice(1).map((s) => (
          <span
            key={s.id}
            title={s.title}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${CHIP[s.severity]}`}
          >
            {signalLabel(s.id)}
          </span>
        ))}
        {entry.paths > 0 && (
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            {plural(entry.paths, "escalation path")}
            {entry.openPaths > 0 && entry.openPaths < entry.paths
              ? `, ${entry.openPaths} unrestricted`
              : entry.openPaths === entry.paths
                ? ", all unrestricted"
                : ", all scoped"}
          </span>
        )}
        <Link
          href={`${href}#risk`}
          className="ml-auto text-xs font-mono text-red-600 dark:text-red-400 hover:underline"
        >
          Why and how to use it
        </Link>
      </div>
    </li>
  );
}

/**
 * The ranked list. Critical and high arrive with the page, so they are in the
 * static HTML; the medium tier is several hundred more policies and is fetched
 * only when someone asks for it.
 */
export default function RiskExplorer({
  initial,
  counts,
  signalCounts,
}: {
  initial: RiskListEntry[];
  counts: Record<RiskLevel, number>;
  signalCounts: Record<string, number>;
}) {
  const [levels, setLevels] = useState<Set<RiskLevel>>(new Set(["critical", "high"]));
  const [signal, setSignal] = useState("ALL");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [all, setAll] = useState<RiskListEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const needsAll = levels.has("medium");
  useEffect(() => {
    if (!needsAll || all) return;
    let cancelled = false;
    fetch("/data/findings.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<FindingsFile>;
      })
      .then((data) => {
        if (!cancelled) setAll(data.risk.policies);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsAll, all]);

  const source = all ?? initial;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter(
      (p) =>
        levels.has(p.level) &&
        (signal === "ALL" || p.signals.some((s) => s.id === signal)) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [source, levels, signal, query]);

  useEffect(() => setShown(PAGE), [levels, signal, query]);

  const toggle = (level: RiskLevel) =>
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level) && next.size > 1) next.delete(level);
      else next.add(level);
      return next;
    });

  const waiting = needsAll && !all && !loadError;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Risk level">
          {RISK_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.has(level)}
              onClick={() => toggle(level)}
              className={`px-3 py-1.5 rounded border text-xs font-mono transition-colors ${
                levels.has(level)
                  ? LEVEL_META[level].badge
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {LEVEL_META[level].label} ({counts[level].toLocaleString("en-US")})
            </button>
          ))}
        </div>
        <select
          name="signal"
          value={signal}
          onChange={(e) => setSignal(e.target.value)}
          aria-label="Signal"
          className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="ALL">Every signal</option>
          {Object.keys(SIGNAL_META)
            .filter((id) => signalCounts[id])
            .map((id) => (
              <option key={id} value={id}>
                {SIGNAL_META[id].label} ({signalCounts[id]})
              </option>
            ))}
        </select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="search"
            name="policyName"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by policy name..."
            aria-label="Filter by policy name"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {loadError
          ? "The medium tier could not be loaded. Reload the page to try again."
          : waiting
            ? "Loading the medium tier..."
            : `${plural(filtered.length, "policy", "policies")}, highest risk first`}
      </p>

      <ul className="space-y-2">
        {filtered.slice(0, shown).map((entry) => (
          <RiskCard key={entry.name} entry={entry} />
        ))}
      </ul>

      {filtered.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full py-2 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
        >
          Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
        </button>
      )}

      {!waiting && filtered.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 py-8 text-center">
          No policy matches these filters.
        </p>
      )}
    </div>
  );
}
