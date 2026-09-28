import { Suspense } from "react";
import Link from "next/link";
import PoliciesBrowser from "./PoliciesBrowser";

type SummaryPolicy = { name: string };

function readPolicyNames(): string[] {
  const fs = require("fs");
  const path = require("path");
  const summary = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public/data/summary.json"), "utf8"),
  );
  return (summary.policies as SummaryPolicy[])
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * What the static HTML carries. The browser reads ?q=, which a static export can
 * only do on the client, so everything inside the Suspense boundary is rendered
 * after load and crawlers would otherwise see an empty page. This index links
 * every policy, then the interactive list replaces it.
 */
function PolicyIndex({ names }: { names: string[] }) {
  return (
    <div className="space-y-6">
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-1">
          All Policies
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Browse {names.length.toLocaleString("en-US")} AWS Managed IAM Policies
          by name, or search an IAM action to find every policy that grants it.
        </p>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm font-mono">
        {names.map((name) => (
          <li key={name} className="truncate">
            <Link
              href={`/policies/${encodeURIComponent(name)}`}
              className="text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<PolicyIndex names={readPolicyNames()} />}>
      <PoliciesBrowser />
    </Suspense>
  );
}
