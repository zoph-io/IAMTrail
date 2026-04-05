import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActionDetail, getActionIndex } from "@/lib/loadActionIndex";
import { iamActionToSlug, iamSlugToAction } from "@/lib/actionSlug";

export async function generateStaticParams() {
  const fs = require("fs");
  const path = require("path");
  const dataPath = path.join(process.cwd(), "public/data/action-index.json");
  if (!fs.existsSync(dataPath)) {
    console.warn("action-index.json missing; no /actions/* static params");
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  return Object.keys(raw.actions).map((action: string) => ({
    action: iamActionToSlug(action),
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ action: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  let action: string;
  try {
    action = iamSlugToAction(params.action);
  } catch {
    action = params.action;
  }
  const slug = params.action;
  return {
    title: `${action} - IAM actions in AWS managed policies`,
    description: `Managed IAM policies that reference the ${action} action as a literal string (wildcards excluded). Unofficial data from IAMTrail.`,
    alternates: {
      canonical: `https://iamtrail.com/actions/${slug}`,
    },
    openGraph: {
      title: `${action} | IAMTrail`,
      description: `Where ${action} appears across AWS managed IAM policies.`,
      url: `https://iamtrail.com/actions/${slug}`,
    },
  };
}

function PolicyLinks({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-zinc-500 dark:text-zinc-400">None</span>;
  }
  return (
    <ul className="space-y-1 text-sm font-mono">
      {names.map((name) => (
        <li key={name}>
          <Link
            href={`/policies/${encodeURIComponent(name)}`}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ActionDetailPage(props: {
  params: Promise<{ action: string }>;
}) {
  const params = await props.params;
  let action: string;
  try {
    action = iamSlugToAction(params.action);
  } catch {
    notFound();
  }
  const detail = getActionDetail(action);
  if (!detail) {
    notFound();
  }

  const idx = getActionIndex();
  const allowN = detail.actionAllowPolicies.length;
  const denyN = detail.actionDenyPolicies.length;
  const notN = detail.notActionPolicies.length;
  const union = new Set([
    ...detail.actionAllowPolicies,
    ...detail.actionDenyPolicies,
    ...detail.notActionPolicies,
  ]);

  return (
    <div className="space-y-6">
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
        <span className="text-zinc-900 dark:text-white truncate">{action}</span>
      </nav>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2 break-all">
          {action}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Literal appearances in AWS managed IAM policies. Statements that use
          wildcards (for example{" "}
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
            s3:*
          </code>
          ) are not counted here. This is not an IAM authorization simulation.
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase text-zinc-500">
              Policies (any)
            </p>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              {union.size}
            </p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase text-zinc-500">
              Allow (Action)
            </p>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              {allowN}
            </p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase text-zinc-500">
              Deny (Action)
            </p>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              {denyN}
            </p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-3">
            <p className="text-[10px] font-mono uppercase text-zinc-500">
              NotAction
            </p>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              {notN}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          Index generated {new Date(idx.generatedAt).toLocaleString()}.{" "}
          {idx.stats.policiesWithWildcardActions} policies include at least one
          wildcard action string (any service).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
              Allow (Action)
            </h2>
          </div>
          <div className="px-5 py-4 max-h-[28rem] overflow-y-auto">
            <PolicyLinks names={detail.actionAllowPolicies} />
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
              Deny (Action)
            </h2>
          </div>
          <div className="px-5 py-4 max-h-[28rem] overflow-y-auto">
            <PolicyLinks names={detail.actionDenyPolicies} />
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
              NotAction
            </h2>
          </div>
          <div className="px-5 py-4 max-h-[28rem] overflow-y-auto">
            <PolicyLinks names={detail.notActionPolicies} />
          </div>
        </div>
      </div>
    </div>
  );
}
