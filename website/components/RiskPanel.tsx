import Link from "next/link";
import { Shield } from "lucide-react";
import RiskBadge from "@/components/RiskBadge";
import { plural } from "@/lib/changes";
import {
  LEVEL_META,
  SIGNAL_META,
  pathfindingUrl,
  signalGuidance,
  type AccessAnalyzerFinding,
  type PolicyRisk,
  type RiskGrant,
  type RiskPath,
  type RiskSignal,
} from "@/lib/risk";

const VISIBLE_PATHS = 8;

const AA_LABEL: Record<AccessAnalyzerFinding["findingType"], string> = {
  ERROR: "Error",
  SECURITY_WARNING: "Security warning",
  WARNING: "Warning",
  SUGGESTION: "Suggestion",
};

/** What narrows a scoped grant, in the words of the policy itself. */
function scopeOf(grant: RiskGrant): string {
  const parts: string[] = [];
  if (grant.conditions.length) parts.push(`condition ${grant.conditions.join(", ")}`);
  const named = grant.resources.filter((r) => r !== "*");
  if (named.length) parts.push(`on ${named.join(", ")}`);
  return parts.join(", ");
}

function PathItem({ path }: { path: RiskPath }) {
  const scoped = (path.grants ?? []).filter((g) => !g.unrestricted);
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <a
          href={pathfindingUrl(path.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-violet-600 dark:text-violet-400 hover:underline"
        >
          {path.id}
        </a>
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{path.name}</span>
        <span
          className={`text-[11px] font-mono ${
            path.unrestricted ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {path.unrestricted ? "unrestricted" : "scoped"}
        </span>
      </div>
      {scoped.length > 0 && (
        <ul className="mt-0.5 pl-3 text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
          {scoped.map((g) => (
            <li key={g.permission} className="break-all">
              {g.permission}
              {g.via !== g.permission ? ` (via ${g.via})` : ""}: {scopeOf(g)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SignalBlock({ signal }: { signal: RiskSignal }) {
  const paths = signal.paths ?? [];
  return (
    <li className={`border-l-4 ${LEVEL_META[signal.severity].accent} pl-3 py-1 space-y-2`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={signal.severity} />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{signal.title}</h3>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{signal.summary}</p>
      </div>

      {paths.length > 0 && (
        <div>
          <ul className="space-y-1.5">
            {paths.slice(0, VISIBLE_PATHS).map((p) => (
              <PathItem key={p.id} path={p} />
            ))}
          </ul>
          {paths.length > VISIBLE_PATHS && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs font-mono text-red-600 dark:text-red-400">
                {plural(paths.length - VISIBLE_PATHS, "more path")}
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {paths.slice(VISIBLE_PATHS).map((p) => (
                  <PathItem key={p.id} path={p} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {signal.actions && signal.actions.length > 0 && (
        <p className="flex flex-wrap gap-1">
          {signal.actions.map((a) => (
            <code
              key={a}
              className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {a}
            </code>
          ))}
          {signal.moreActions ? (
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 self-center">
              and {signal.moreActions} more
            </span>
          ) : null}
        </p>
      )}

      {signal.evidence && signal.evidence.length > 0 && (
        <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
          {signal.evidence.map((e) => (
            <li key={e} className="font-mono break-all">
              {e}
            </li>
          ))}
        </ul>
      )}

      {SIGNAL_META[signal.id] && (
        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <span className="font-semibold">Use with caution:</span> {signalGuidance(signal)}
        </p>
      )}
    </li>
  );
}

/**
 * The risk assessment of one policy, with the evidence behind each signal. Shown
 * whenever the policy carries a signal or an Access Analyzer finding.
 */
export default function RiskPanel({
  risk,
  accessAnalyzer,
}: {
  risk: PolicyRisk | null;
  accessAnalyzer: AccessAnalyzerFinding[];
}) {
  if (!risk && accessAnalyzer.length === 0) return null;
  return (
    <section
      id="risk"
      aria-labelledby="risk-title"
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 scroll-mt-20"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded flex-shrink-0">
          <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </div>
        <div className="space-y-4 min-w-0 flex-1">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="risk-title"
                className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white"
              >
                Risk
              </h2>
              {risk ? (
                <RiskBadge level={risk.level} />
              ) : (
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">no risk signal</span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {risk ? `${LEVEL_META[risk.level].meaning} ` : ""}
              Read from this policy document alone: trust policies, boundaries and
              SCPs in your account still decide what actually succeeds.{" "}
              <Link href="/findings#methodology" className="text-red-600 dark:text-red-400 hover:underline">
                How this is assessed
              </Link>
            </p>
          </div>

          {risk && (
            <ul className="space-y-4">
              {risk.signals.map((s) => (
                <SignalBlock key={s.id} signal={s} />
              ))}
            </ul>
          )}

          {accessAnalyzer.length > 0 && (
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                IAM Access Analyzer ({accessAnalyzer.length})
              </h3>
              <ul className="space-y-2">
                {accessAnalyzer.map((f, i) => (
                  <li key={`${f.issueCode}-${i}`} className="text-sm">
                    <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
                      {AA_LABEL[f.findingType] ?? f.findingType} / {f.issueCode}
                    </span>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {f.findingDetails}{" "}
                      {f.learnMoreLink && (
                        <a
                          href={f.learnMoreLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 dark:text-red-400 hover:underline"
                        >
                          AWS docs
                        </a>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
