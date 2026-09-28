"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Copy } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { LIST_ATTACHED_COMMAND, parseAttachedPolicies } from "@/lib/attachedPolicies";
import { plural } from "@/lib/changes";
import { LEVEL_RANK_UI, type RiskLevel } from "@/lib/risk";

type Lookup = { names: string[]; risk: Record<string, [RiskLevel, string]> };

type Result = {
  flagged: { name: string; level: RiskLevel; headline: string }[];
  clean: number;
  unknown: string[];
  customerManaged: number;
};

/**
 * Answers "which of the AWS managed policies we use need caution?" from the
 * output of list-policies. Parsed in the browser; nothing pasted is sent.
 */
export default function RiskChecker() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [copied, setCopied] = useState(false);

  const check = async () => {
    setState("loading");
    try {
      const res = await fetch("/data/risk-lookup.json");
      if (!res.ok) throw new Error(String(res.status));
      const lookup = (await res.json()) as Lookup;
      const parsed = parseAttachedPolicies(text, lookup.names);
      const flagged = parsed.matched
        .filter((name) => lookup.risk[name])
        .map((name) => ({ name, level: lookup.risk[name][0], headline: lookup.risk[name][1] }))
        .sort((a, b) => LEVEL_RANK_UI[b.level] - LEVEL_RANK_UI[a.level] || a.name.localeCompare(b.name));
      setResult({
        flagged,
        clean: parsed.matched.length - flagged.length,
        unknown: parsed.unknown,
        customerManaged: parsed.customerManaged,
      });
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(LIST_ATTACHED_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const total = result ? result.flagged.length + result.clean : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
          Check the policies your account uses
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Run this with credentials for your account and paste the output, or
          paste any list of policy names or ARNs. It is read in your browser and
          never uploaded.
        </p>
      </div>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap px-3 py-2 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200">
          {LIST_ATTACHED_COMMAND}
        </code>
        <button
          type="button"
          onClick={copyCommand}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        name="attachedPolicies"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="Attached policies"
        placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess  arn:aws:iam::aws:policy/PowerUserAccess ..."
        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={check}
        disabled={!text.trim() || state === "loading"}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded text-xs font-mono font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
      >
        <ClipboardCheck className="w-3.5 h-3.5" />
        {state === "loading" ? "Checking..." : "Check these policies"}
      </button>

      {state === "error" && (
        <p className="text-xs font-mono text-red-600 dark:text-red-400">
          The risk data could not be loaded, so nothing was checked. Reload the
          page to try again.
        </p>
      )}

      {result && state !== "error" && (
        <div className="space-y-2 pt-1">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            {total === 0
              ? "No tracked AWS managed policy found in what you pasted."
              : result.flagged.length === 0
                ? `None of your ${plural(total, "AWS managed policy", "AWS managed policies")} carries a risk signal.`
                : `${result.flagged.length} of your ${plural(total, "AWS managed policy", "AWS managed policies")} ${result.flagged.length === 1 ? "needs" : "need"} caution.`}
          </p>
          {result.flagged.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded">
              {result.flagged.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <RiskBadge level={p.level} />
                  <Link
                    href={`/policies/${encodeURIComponent(p.name)}#risk`}
                    className="font-mono text-sm text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 break-all"
                  >
                    {p.name}
                  </Link>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.headline}</span>
                </li>
              ))}
            </ul>
          )}
          {result.unknown.length > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Not tracked, usually deprecated: {result.unknown.slice(0, 10).join(", ")}
              {result.unknown.length > 10 ? ` and ${result.unknown.length - 10} more` : ""}
            </p>
          )}
          {result.customerManaged > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Skipped{" "}
              {plural(result.customerManaged, "customer managed policy", "customer managed policies")},
              which only your account can see.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
