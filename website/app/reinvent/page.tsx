import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight } from "lucide-react";
import RelatedPages from "@/components/RelatedPages";
import {
  OfficialLinks,
  ReinventStats,
  seasonLead,
} from "@/components/ReinventEditionView";
import { plural } from "@/lib/changes";
import {
  conferenceLabel,
  endpointTotal,
  loadReinvent,
  type ReinventEdition,
} from "@/lib/reinvent";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AWS re:Invent in IAM",
  description:
    "What showed up in AWS managed IAM policies each re:Invent season, October 1 through December 31, beside the official announcement roundup.",
  path: "/reinvent",
});

function ArchiveCard({ edition }: { edition: ReinventEdition }) {
  const when = conferenceLabel(edition.conference);
  return (
    <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/reinvent/${edition.year}`}
          className="text-lg font-bold font-mono text-zinc-900 dark:text-white hover:text-red-600 dark:hover:text-red-400"
        >
          re:Invent {edition.year}
        </Link>
        {edition.roundup ? (
          <a
            href={edition.roundup.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
          >
            Announcement roundup
          </a>
        ) : null}
      </div>
      {when ? (
        <p className="mt-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          {when}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {plural(edition.services.length, "new AWS service")},{" "}
        {plural(edition.neverBeforeSeen, "never-before-seen action")},{" "}
        {plural(edition.changes, "policy change")}
        {endpointTotal(edition) > 0
          ? `, ${plural(endpointTotal(edition), "endpoint change")}`
          : ""}
        .
      </p>
      {edition.beforeConference > 0 ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {plural(edition.beforeConference, "new AWS service")} before the
          conference.
        </p>
      ) : null}
      <Link
        href={`/reinvent/${edition.year}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
      >
        View the season
        <ChevronRight className="w-4 h-4" />
      </Link>
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

  return (
    <div className="space-y-10">
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="w-7 h-7 text-amber-500" />
            <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              re:Invent
            </h1>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Each season runs {archive.windowLabel}. AWS often
            ships the IAM component in October and November, ahead of the
            conference, so a new AWS service can show up here before the
            announcement. The roundup links are the AWS News Blog posts for
            that year.
          </p>
        </div>
      </div>

      {current ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
                This season
              </h2>
              <p className="mt-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                re:Invent {current.year}
                {current.conference
                  ? ` / ${conferenceLabel(current.conference)}`
                  : ""}
              </p>
            </div>
            <Link
              href={`/reinvent/${current.year}`}
              className="inline-flex items-center gap-1 text-sm font-medium font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Full season
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <ReinventStats edition={current} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            {seasonLead(current, archive.generatedAt)}
          </p>
          <OfficialLinks edition={current} />
        </section>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
          The next season opens October 1. Until then, the archive below is
          every re:Invent since 2020.
        </p>
      )}

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
