import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  GitBranch,
  ShieldCheck,
  Shield,
  Globe,
  Search,
  FileText,
  Rss,
  Mail,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About IAMTrail - AWS IAM Policy, Endpoint & GuardDuty Change Archive",
  description:
    "IAMTrail is an unofficial archive tracking AWS Managed IAM Policy changes, endpoint updates, and GuardDuty announcements since 2019. Full version history, diffs, validation, and RSS feeds.",
  alternates: {
    canonical: "https://iamtrail.com/about",
  },
  openGraph: {
    title: "About IAMTrail | AWS Change Archive Since 2019",
    description:
      "An unofficial archive tracking AWS IAM policy changes, endpoint updates, and GuardDuty announcements - with full version history, diffs, and RSS feeds.",
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
          An unofficial archive tracking AWS Managed IAM Policy changes,
          endpoint updates, and GuardDuty announcements since 2019 - with full
          version history, diffs, and dedicated RSS feeds.
        </p>
      </div>

      {/* Origin Story */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded flex-shrink-0">
            <BookOpen className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
              Why IAMTrail Exists
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AWS updates its managed IAM policies constantly - often without
              any announcement. Security teams, compliance officers, and cloud
              architects need visibility into these silent changes. ISVs and
              SaaS founders building on AWS also heavily rely on managed
              policies for their integrations and need to know immediately when
              permissions shift under their products.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              IAMTrail was started in{" "}
              <strong className="text-zinc-900 dark:text-white">2019</strong>,
              inspired by{" "}
              <a
                href="https://twitter.com/0xdabbad00"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Scott Piper
              </a>
              &apos;s{" "}
              <a
                href="https://github.com/SummitRoute/aws_managed_policies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                aws_managed_policies
              </a>{" "}
              project. What began as an automated fork has grown into a broader
              observatory of AWS infrastructure changes - covering not just IAM
              policies but also endpoint expansions, GuardDuty announcements,
              and AWS account identification.
            </p>
          </div>
        </div>
      </section>

      {/* What We Track */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          What We Track
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/policies"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 group hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                IAM Policy Changes
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              The original archive. Every AWS managed IAM policy versioned in
              Git with full diffs and Access Analyzer validation. Spot new
              service launches early via v1 policies.
            </p>
          </Link>

          <Link
            href="/endpoints"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 group hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <Globe className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                Endpoint Changes
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tracks changes to botocore&apos;s{" "}
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                endpoints.json
              </code>{" "}
              - new regions, new services, and service expansions. Refreshed
              every 6 hours.
            </p>
          </Link>

          <Link
            href="/guardduty"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 group hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                GuardDuty Announcements
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Archives GuardDuty SNS announcements - new findings, feature
              updates, and region expansions. The successor to the former
              @mgda_aws feed.
            </p>
          </Link>

          <Link
            href="/accounts"
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 group hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded">
                <Search className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                AWS Account Lookup
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Identify AWS account owners from an account ID, powered by the{" "}
              <span className="font-medium">
                fwdcloudsec/known_aws_accounts
              </span>{" "}
              community dataset. Useful for CloudTrail and trust policy
              investigations.
            </p>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Scheduled tasks fetch AWS managed policies, botocore endpoints,
              and GuardDuty announcements multiple times per day.
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
              Every change is committed to Git with full diff history preserved
              indefinitely. Nothing is ever silently overwritten.
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
              IAM policies are validated using AWS Access Analyzer to flag
              security warnings, best practice issues, and redundant statements.
            </p>
          </div>
        </div>
      </section>

      {/* Stay Informed */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-5">
        <h2 className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
          Stay Informed
        </h2>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-orange-50 dark:bg-orange-950/30 rounded flex-shrink-0 mt-0.5">
              <Rss className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">
                RSS Feeds
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
                Each data source has its own dedicated feed so you can subscribe
                to exactly what you care about. See all available feeds on
                the{" "}
                <Link
                  href="/feeds"
                  className="text-red-600 dark:text-red-400 hover:underline font-medium"
                >
                  RSS Feeds page
                </Link>
                .
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "All Changes", href: "/feeds/all.xml" },
                  { label: "IAM Policies", href: "/feeds/iam-policies.xml" },
                  { label: "Endpoints", href: "/feeds/endpoints.xml" },
                  { label: "GuardDuty", href: "/feeds/guardduty.xml" },
                ].map((feed) => (
                  <a
                    key={feed.href}
                    href={feed.href}
                    className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-orange-100 dark:hover:bg-orange-950/40 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                  >
                    <Rss className="w-3 h-3" />
                    {feed.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-red-50 dark:bg-red-950/30 rounded flex-shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">
                Email Digests & Social
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Get policy change summaries delivered to your inbox via{" "}
                <Link
                  href="/subscribe"
                  className="text-red-600 dark:text-red-400 hover:underline font-medium"
                >
                  email digests
                </Link>
                , or follow along on{" "}
                <a
                  href="https://bsky.app/profile/iamtrail.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 dark:text-red-400 hover:underline font-medium"
                >
                  Bluesky
                </a>{" "}
                and{" "}
                <a
                  href="https://x.com/iamtrail_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 dark:text-red-400 hover:underline font-medium"
                >
                  X
                </a>
                .
              </p>
            </div>
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
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded font-mono font-semibold text-sm hover:bg-red-700 transition-colors"
        >
          Explore IAMTrail
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
