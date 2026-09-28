import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ExternalLink } from "lucide-react";
import RelatedPages from "@/components/RelatedPages";
import RiskBadge from "@/components/RiskBadge";
import { plural } from "@/lib/changes";
import {
  LEVEL_META,
  RISK_LEVELS,
  SIGNAL_META,
  pathfindingUrl,
  type FindingsFile,
  type RiskChange,
} from "@/lib/risk";
import RiskChecker from "./RiskChecker";
import RiskExplorer from "./RiskExplorer";

const GITHUB_REPO = "https://github.com/zoph-io/IAMTrail";
const MAX_CHANGE_PATHS = 6;

/** Written by generate-data.js, which fails the build rather than skip it. */
function readFindings(): FindingsFile {
  const fs = require("fs");
  const path = require("path");
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "public/data/findings.json"), "utf8")
  );
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const linkClass = "text-red-600 dark:text-red-400 hover:underline font-medium";

function ChangeRow({ change }: { change: RiskChange }) {
  const arrow = {
    riskier: { Icon: ArrowUpRight, color: "text-red-600 dark:text-red-400" },
    safer: { Icon: ArrowDownRight, color: "text-green-600 dark:text-green-400" },
    changed: { Icon: ArrowRight, color: "text-zinc-400" },
  }[change.direction];
  return (
    <li className="px-4 py-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <time dateTime={change.date} className="text-xs font-mono text-zinc-500 dark:text-zinc-400 w-24 flex-shrink-0">
          {formatDay(change.date)}
        </time>
        <Link
          href={`/policies/${encodeURIComponent(change.policy)}#risk`}
          className="font-mono text-sm font-semibold text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 break-all"
        >
          {change.policy}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          {change.kind === "new" ? (
            <span>new policy, already</span>
          ) : change.from === change.to ? (
            <span>still</span>
          ) : (
            <>
              {change.from ? <RiskBadge level={change.from} /> : <span>no signal</span>}
              <arrow.Icon className={`w-3.5 h-3.5 ${arrow.color}`} aria-label={change.direction} />
            </>
          )}
          {change.to ? <RiskBadge level={change.to} /> : <span>no signal</span>}
        </span>
        <a
          href={`${GITHUB_REPO}/commit/${change.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
        >
          diff
        </a>
      </div>
      <ul className="sm:pl-[6.5rem] text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
        {change.added.map((s) => (
          <li key={`+${s.id}`}>
            <span className="font-mono text-red-600 dark:text-red-400">+</span> {s.title}
          </li>
        ))}
        {change.removed.map((s) => (
          <li key={`-${s.id}`}>
            <span className="font-mono text-green-600 dark:text-green-400">-</span> {s.title}
          </li>
        ))}
        {change.pathsAdded.length > 0 && (
          <li className="text-xs text-zinc-500 dark:text-zinc-400">
            {plural(change.pathsAdded.length, "unrestricted escalation path")} added:{" "}
            {change.pathsAdded.slice(0, MAX_CHANGE_PATHS).map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <a href={pathfindingUrl(id)} target="_blank" rel="noopener noreferrer" className="font-mono hover:underline">
                  {id}
                </a>
              </span>
            ))}
            {change.pathsAdded.length > MAX_CHANGE_PATHS ? ` and ${change.pathsAdded.length - MAX_CHANGE_PATHS} more` : ""}
          </li>
        )}
        {change.pathsRemoved.length > 0 && (
          <li className="text-xs text-zinc-500 dark:text-zinc-400">
            {plural(change.pathsRemoved.length, "unrestricted escalation path")} removed
          </li>
        )}
      </ul>
    </li>
  );
}

const AA_TYPES = [
  { type: "SECURITY_WARNING", label: "Security warnings", note: "Also counted in the risk levels above." },
  { type: "ERROR", label: "Errors", note: "Elements IAM ignores, such as actions or regions that do not exist." },
  { type: "WARNING", label: "Warnings", note: "Statements that do not do what they appear to." },
  { type: "SUGGESTION", label: "Suggestions", note: "Redundant or simplifiable elements." },
] as const;

export default function FindingsPage() {
  const data = readFindings();
  const { risk, accessAnalyzer: aa, pathfinding } = data;
  const initial = risk.policies.filter((p) => p.level !== "medium");
  const flagged = risk.counts.critical + risk.counts.high + risk.counts.medium;

  const issueCodes = new Map<string, { type: string; policies: string[] }>();
  for (const pol of aa.policies) {
    for (const f of pol.findings) {
      const entry = issueCodes.get(f.issueCode) ?? { type: f.findingType, policies: [] };
      if (!entry.policies.includes(pol.name)) entry.policies.push(pol.name);
      issueCodes.set(f.issueCode, entry);
    }
  }

  return (
    <div className="space-y-10">
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
            Security findings
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            AWS managed policies are convenient, and some hand out far more than
            their name suggests. IAMTrail reads every one of them and flags the
            policies that grant administrator access, a documented privilege
            escalation path, secret reads or the power to switch off security
            monitoring, so you can attach them with your eyes open.
          </p>
          <p className="mt-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {plural(flagged, "policy", "policies")} flagged out of{" "}
            {data.totalPoliciesAnalyzed.toLocaleString("en-US")}, re-assessed on
            every policy change. Last run {formatDay(data.generatedAt)}.
          </p>
        </div>
      </div>

      <section aria-labelledby="levels" className="space-y-3">
        <h2 id="levels" className="sr-only">
          Risk levels
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {RISK_LEVELS.map((level) => (
            <div
              key={level}
              className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${LEVEL_META[level].accent} rounded-lg p-4`}
            >
              <div className="flex items-baseline justify-between">
                <RiskBadge level={level} />
                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
                  {risk.counts[level].toLocaleString("en-US")}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {LEVEL_META[level].meaning}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <strong className="font-mono">{risk.escalationAny}</strong> policies grant every
          action of at least one documented privilege escalation path, and{" "}
          <strong className="font-mono">{risk.escalationOpen}</strong> of them do it on any
          resource with no condition attached.
        </p>
      </section>

      <RiskChecker />

      <section aria-labelledby="risk-changes" className="space-y-3">
        <div>
          <h2 id="risk-changes" className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
            Risk changes in the last {risk.changesWindowDays} days
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            Policy versions that AWS made riskier or safer, and new policies that
            shipped already critical or high. A policy you attached last year can
            change under you; this is where it shows.{" "}
            <Link href="/subscribe" className={linkClass}>
              Subscribe
            </Link>{" "}
            to the policies you use to hear about the next one.
          </p>
        </div>
        {risk.changes.length > 0 ? (
          <ul className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
            {risk.changes.map((c) => (
              <ChangeRow key={`${c.hash}:${c.policy}`} change={c} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No policy version changed its risk level or signals in this window.
          </p>
        )}
      </section>

      <section aria-labelledby="ranked" className="space-y-3">
        <div>
          <h2 id="ranked" className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
            Policies to use with caution
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            Highest risk first. Each policy page explains every signal, shows the
            statement that grants it and how to use the policy safely.
          </p>
        </div>
        <RiskExplorer initial={initial} counts={risk.counts} signalCounts={risk.signalCounts} />
      </section>

      <section id="methodology" aria-labelledby="methodology-title" className="space-y-4 scroll-mt-20">
        <h2 id="methodology-title" className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          How the risk is assessed
        </h2>
        <div className="max-w-3xl space-y-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p>
            Every Allow statement is read the way IAM reads it: wildcards such as{" "}
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">iam:Put*</code>{" "}
            and NotAction included, and an unconditional Deny in the same policy
            cancels what it covers. Each capability is then marked{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">unrestricted</strong> when
            it applies to every resource with no condition, or{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">scoped</strong> when a
            resource ARN or a Condition narrows it. That is the difference between
            IAMFullAccess and a service policy that may only pass its own service
            role, and it decides the level.
          </p>
          <p>
            Escalation paths come from the{" "}
            <a href="https://pathfinding.cloud/paths/" target="_blank" rel="noopener noreferrer" className={linkClass}>
              pathfinding.cloud
            </a>{" "}
            catalog ({plural(pathfinding.pathsInCatalog, "path")}
            {pathfinding.catalogLastUpdated ? `, updated ${formatDay(pathfinding.catalogLastUpdated)}` : ""}
            ), open source by Datadog under Apache-2.0. Permissions management
            follows the access levels of the AWS Service Authorization Reference,
            through{" "}
            <a href="https://github.com/iann0036/iam-dataset" target="_blank" rel="noopener noreferrer" className={linkClass}>
              iam-dataset
            </a>
            . Secret reads and monitoring actions are curated lists, named on each
            policy page.
          </p>
        </div>
        <dl className="grid gap-3 md:grid-cols-2">
          {Object.entries(SIGNAL_META).map(([id, meta]) => (
            <div key={id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <dt className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">
                {meta.label}
                {risk.signalCounts[id] ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {plural(risk.signalCounts[id], "policy", "policies")}
                  </span>
                ) : null}
              </dt>
              <dd className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{meta.meaning}</dd>
              <dd className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <span className="font-semibold">Use with caution:</span> {meta.guidance}
              </dd>
            </div>
          ))}
        </dl>
        <div className="max-w-3xl rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-2">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">What this cannot see</p>
          <p>
            Only the policy document is read. Trust policies, permissions
            boundaries, SCPs and the roles that exist in your account decide
            whether an escalation actually succeeds, so a flag means the policy
            grants the actions, not that your account is exploitable. Conditions
            count as scoping without being evaluated. Many flagged policies are
            meant for a role an AWS service assumes; there the risk is whoever can
            control that service.
          </p>
          <p>
            The same data is published as{" "}
            <a href="/api/v1/risk.json" className={linkClass}>
              /api/v1/risk.json
            </a>{" "}
            for pipelines that want to refuse a critical policy before it is
            attached. See the{" "}
            <Link href="/api" className={linkClass}>
              API documentation
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="access-analyzer" aria-labelledby="aa-title" className="space-y-4 scroll-mt-20">
        <div>
          <h2 id="aa-title" className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
            Policy validation by IAM Access Analyzer
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            AWS&apos;s own validator, run on every managed policy.{" "}
            {plural(aa.policiesWithFindings, "policy", "policies")} carry{" "}
            {plural(aa.totalFindingRows, "finding")}. Most are hygiene rather than
            risk: AWS shipping actions and regions that do not exist. Each policy
            page lists its findings in full.
          </p>
        </div>
        <div className="space-y-2">
          {AA_TYPES.map(({ type, label, note }) => {
            const codes = [...issueCodes.entries()]
              .filter(([, v]) => v.type === type)
              .sort((a, b) => b[1].policies.length - a[1].policies.length);
            if (!codes.length) return null;
            return (
              <details
                key={type}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
              >
                <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold font-mono text-zinc-900 dark:text-white">
                    {label}
                  </span>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                    {plural(aa.byType[type] || 0, "finding")}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{note}</span>
                  <span className="ml-auto text-xs font-mono text-red-600 dark:text-red-400 group-open:hidden">
                    Show
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {codes.map(([code, v]) => (
                    <div key={code}>
                      <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
                        {code}{" "}
                        <span className="text-zinc-500 dark:text-zinc-400">
                          ({plural(v.policies.length, "policy", "policies")})
                        </span>
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {v.policies.sort().map((name, i) => (
                          <span key={name}>
                            {i > 0 && ", "}
                            <Link
                              href={`/policies/${encodeURIComponent(name)}#risk`}
                              className="font-mono text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              {name}
                            </Link>
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
          Finding types are described in the{" "}
          <a
            href="https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-reference-policy-checks.html"
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} inline-flex items-center gap-0.5`}
          >
            Access Analyzer policy check reference
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </section>

      <RelatedPages current="/findings" />
    </div>
  );
}
