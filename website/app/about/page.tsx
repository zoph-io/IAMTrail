import type { Metadata } from "next";
import Link from "next/link";
import {
  Info,
  Clock,
  GitBranch,
  ShieldCheck,
  Bell,
  Search,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About IAMTrail - How We Track AWS IAM Policy Changes",
  description:
    "Learn how IAMTrail monitors and archives every change to AWS Managed IAM Policies using automated infrastructure, git version control, and policy validation.",
  alternates: {
    canonical: "https://iamtrail.com/about",
  },
  openGraph: {
    title: "About IAMTrail | AWS Managed Policy Changes Archive",
    description:
      "Learn how IAMTrail monitors and archives every change to AWS Managed IAM Policies.",
    url: "https://iamtrail.com/about",
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-3xl font-bold font-mono text-zinc-900 dark:text-white mb-3">
          About IAMTrail
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
          An unofficial archive tracking every change to AWS Managed IAM
          Policies since 2019 - with full version history, diffs, and policy
          validation.
        </p>
      </div>

      {/* What & Why */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded flex-shrink-0">
            <Info className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              What is IAMTrail?
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AWS updates its managed IAM policies constantly - often without
              announcement. IAMTrail catches every change and stores full
              version history in Git, so you can see exactly what was added,
              removed, or modified.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This is useful for staying on top of security changes, spotting
              new AWS service launches early (via v1 policies), and keeping
              compliance documentation current.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                Automated Collection
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              A scheduled task fetches all AWS managed policies via the AWS API
              multiple times per day on weekdays.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                <GitBranch className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                Git Version Control
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Each policy is stored as a JSON file. When changes are detected,
              they are committed to Git with full diff history preserved
              indefinitely.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <ShieldCheck className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                Policy Validation
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every policy is validated using AWS IAM Access Analyzer to flag
              security warnings, best practice issues, and redundant
              statements.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded">
                <Bell className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
                Notifications
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Policy changes are broadcast on{" "}
              <a
                href="https://bsky.app/profile/iamtrail.bsky.social"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                Bluesky
              </a>
              ,{" "}
              <a
                href="https://x.com/iamtrail_"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                X
              </a>
              , and via{" "}
              <Link
                href="/subscribe"
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                email digests
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* AWS Account Lookup */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded flex-shrink-0">
            <Search className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              AWS Account Lookup
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              IAMTrail includes a{" "}
              <Link
                href="/accounts"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Known AWS Account Lookup
              </Link>{" "}
              tool powered by the{" "}
              <a
                href="https://github.com/fwdcloudsec/known_aws_accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                fwdcloudsec/known_aws_accounts
              </a>{" "}
              community dataset. Paste an AWS account ID to identify its
              owner - useful when investigating CloudTrail logs, S3 bucket
              policies, or IAM trust relationships.
            </p>
          </div>
        </div>
      </section>

      {/* Credits */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          Credits
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            The original idea for tracking AWS Managed IAM Policies comes from{" "}
            <a
              href="https://twitter.com/0xdabbad00"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              Scott Piper
            </a>{" "}
            (SummitRoute), who created the{" "}
            <a
              href="https://github.com/SummitRoute/aws_managed_policies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              aws_managed_policies
            </a>{" "}
            repository. IAMTrail builds on that idea with automated
            infrastructure, continuous monitoring, policy validation, and this
            web interface.
          </p>
          <div className="flex items-start gap-4 pt-2">
            <img
              src="/zoph-logo.png"
              alt="zoph.io"
              className="h-10 w-auto dark:brightness-110 flex-shrink-0"
            />
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Created and maintained by{" "}
              <a
                href="https://zoph.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                zoph.io
              </a>
              , an AWS Cloud Advisory Boutique based in France, specializing
              in cloud security, compliance, and infrastructure automation.
            </p>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            This is an <strong>unofficial archive</strong> and is not
            affiliated with, endorsed by, or sponsored by Amazon Web Services
            (AWS). AWS and related marks are trademarks of Amazon.com, Inc.
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center pb-4">
        <Link
          href="/policies"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded font-mono font-semibold text-sm hover:bg-red-700 transition-colors"
        >
          Explore Policy Archive
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
