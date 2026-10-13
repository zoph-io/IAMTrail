import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight } from "lucide-react";
import RelatedPages from "@/components/RelatedPages";
import {
  OfficialLinks,
  ReinventStats,
  seasonLead,
} from "@/components/ReinventEditionView";
import VegasFrame, { BulbRow } from "@/components/VegasFrame";
import { plural } from "@/lib/changes";
import {
  conferenceLabel,
  endpointTotal,
  formatDay,
  loadReinvent,
  preReinventionPosts,
  type ReinventEdition,
} from "@/lib/reinvent";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AWS re:Invent in IAM",
  description:
    "What showed up in AWS managed IAM policies each re:Invent season, October through December, with the pre-re:Invent What's New posts.",
  path: "/reinvent",
});

const PREVIEW = 5;

function ArchiveCard({ edition }: { edition: ReinventEdition }) {
  const when = conferenceLabel(edition.conference);
  const pre = preReinventionPosts(edition);
  return (
    <article className="overflow-hidden rounded-lg border border-amber-400/30 bg-zinc-950 text-zinc-100">
      <BulbRow count={12} />
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Link
            href={`/reinvent/${edition.year}`}
            className="text-lg font-bold font-mono text-amber-100 hover:text-white"
          >
            re:Invent {edition.year}
          </Link>
          {edition.roundup ? (
            <a
              href={edition.roundup.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-300 hover:text-white hover:underline font-medium"
            >
              Announcement roundup
            </a>
          ) : null}
        </div>
        {when ? (
          <p className="mt-1 text-xs font-mono text-zinc-400">{when}</p>
        ) : null}
        <p className="mt-3 text-sm text-zinc-300">
          {plural(edition.services.length, "new AWS service")},{" "}
          {plural(edition.neverBeforeSeen, "never-before-seen action")},{" "}
          {plural(edition.changes, "policy change")}
          {endpointTotal(edition) > 0
            ? `, ${plural(endpointTotal(edition), "endpoint change")}`
            : ""}
          .
        </p>
        {edition.beforeConference > 0 ? (
          <p className="mt-1 text-xs text-zinc-400">
            {plural(edition.beforeConference, "new AWS service")} pre-re:Invent.
          </p>
        ) : null}
        {pre === null ? (
          <p className="mt-1 text-xs text-rose-300">What&apos;s New data unavailable.</p>
        ) : pre.length > 0 ? (
          <p className="mt-1 text-xs text-amber-200/90">
            {plural(pre.length, "pre-re:Invent announcement")}.
          </p>
        ) : null}
        <Link
          href={`/reinvent/${edition.year}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium font-mono text-amber-300 hover:text-white"
        >
          View the season
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}

export default function ReinventPage() {
  const archive = loadReinvent();
  const current = archive.currentYear
    ? archive.editions.find((edition) => edition.year === archive.currentYear)
    : null;
  const previous = archive.editions.filter(
    (edition) => edition.year !== archive.currentYear,
  );
  const pre = current ? preReinventionPosts(current) : null;
  const preview = pre ? pre.slice(0, PREVIEW) : [];

  return (
    <div className="space-y-10">
      <VegasFrame>
        <div className="px-5 py-6 sm:px-6 space-y-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays className="w-7 h-7 text-amber-300" />
              <h1 className="text-2xl font-bold font-mono text-white">re:Invent</h1>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Each season runs {archive.windowLabel}. AWS often ships the IAM
              component in October and November, ahead of the conference. Major
              What&apos;s New posts from that window are listed as pre-re:Invent.
              The roundup link is the AWS News Blog post for that year.
            </p>
          </div>

          {current ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-amber-200">
                    This season
                  </h2>
                  <p className="mt-1 text-xs font-mono text-zinc-400">
                    re:Invent {current.year}
                    {current.conference
                      ? ` / ${conferenceLabel(current.conference)}`
                      : ""}
                  </p>
                </div>
                <Link
                  href={`/reinvent/${current.year}`}
                  className="inline-flex items-center gap-1 text-sm font-medium font-mono text-amber-300 hover:text-white"
                >
                  Full season
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <ReinventStats edition={current} tone="vegas" />
              <p className="text-sm text-zinc-300 max-w-3xl">
                {seasonLead(current, archive.generatedAt)}
              </p>
              <OfficialLinks edition={current} />
              {pre === null ? (
                <p className="text-sm text-rose-300">What&apos;s New data unavailable.</p>
              ) : preview.length > 0 ? (
                <div>
                  <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-amber-300">
                    Pre-re:Invent
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {preview.map((post) => (
                      <li key={post.url}>
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-amber-100 hover:text-white hover:underline"
                        >
                          {post.headline}
                        </a>
                        <span className="ml-2 text-xs font-mono text-zinc-500">
                          {formatDay(post.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pre.length > preview.length ? (
                    <Link
                      href={`/reinvent/${current.year}`}
                      className="mt-2 inline-block text-sm font-mono text-amber-300 hover:text-white"
                    >
                      {plural(pre.length - preview.length, "more announcement")}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-300 max-w-3xl">
              The next season opens October 1. Until then, the archive below is
              every re:Invent since 2020.
            </p>
          )}
        </div>
      </VegasFrame>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
          {current ? "Previous seasons" : "Archive"}
        </h2>
        {previous.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No earlier season is in the archive yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previous.map((edition) => (
              <ArchiveCard key={edition.year} edition={edition} />
            ))}
          </div>
        )}
      </section>

      <RelatedPages current="/reinvent" />
    </div>
  );
}
