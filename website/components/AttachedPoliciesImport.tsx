"use client";

import { useState } from "react";
import { ClipboardPaste, Copy } from "lucide-react";
import {
  LIST_ATTACHED_COMMAND,
  parseAttachedPolicies,
  type ImportResult,
} from "@/lib/attachedPolicies";
import { plural } from "@/lib/changes";

const MAX_LISTED_UNKNOWN = 10;

/**
 * Turns the output of `aws iam list-policies --only-attached` into a policy
 * selection. Almost every subscriber picked "All policies" because nobody knows
 * which of 1,400+ managed policies their accounts use, so the filter went unused.
 * Parsing happens in the browser: nothing pasted here is sent anywhere.
 */
export default function AttachedPoliciesImport({
  knownPolicies,
  onImport,
}: {
  knownPolicies: string[];
  onImport: (names: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleImport = () => {
    const parsed = parseAttachedPolicies(text, knownPolicies);
    setResult(parsed);
    if (parsed.matched.length > 0) onImport(parsed.matched);
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

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 mb-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-white">
          Only the policies your account uses
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Run this with credentials for your account, then paste the output. It
          is read in your browser and never uploaded; only the matched policy
          names are saved with your subscription.
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
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess  arn:aws:iam::aws:policy/AmazonS3FullAccess ..."
        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={handleImport}
        disabled={!text.trim() || knownPolicies.length === 0}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded text-xs font-mono font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
      >
        <ClipboardPaste className="w-3.5 h-3.5" />
        Select these policies
      </button>
      {result && (
        <div className="text-xs font-mono space-y-1">
          <p
            className={
              result.matched.length > 0
                ? "text-green-700 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {result.matched.length > 0
              ? `${plural(result.matched.length, "AWS managed policy", "AWS managed policies")} selected`
              : "No tracked AWS managed policy found in what you pasted"}
          </p>
          {result.unknown.length > 0 && (
            <p className="text-zinc-500 dark:text-zinc-400">
              Not tracked, usually deprecated:{" "}
              {result.unknown.slice(0, MAX_LISTED_UNKNOWN).join(", ")}
              {result.unknown.length > MAX_LISTED_UNKNOWN
                ? ` and ${result.unknown.length - MAX_LISTED_UNKNOWN} more`
                : ""}
            </p>
          )}
          {result.customerManaged > 0 && (
            <p className="text-zinc-500 dark:text-zinc-400">
              Skipped {plural(result.customerManaged, "customer managed policy", "customer managed policies")}, which
              only your account can see.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
