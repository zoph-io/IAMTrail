import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronRight } from "lucide-react";
import RelatedPages from "@/components/RelatedPages";
import {
  countdownLabel,
  OfficialLinks,
  ReinventStats,
  seasonLead,
} from "@/components/ReinventEditionView";
import VegasFrame, { BulbRow } from "@/components/VegasFrame";
import { plural } from "@/lib/changes";
import {
  conferenceLabel,
  formatDay,
  loadReinvent,
  preReinventionPosts,
  spottedServices,
  type ReinventEdition,
  type ReinventService,
} from "@/lib/reinvent";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AWS re:Invent in IAM",
  description:
    "New AWS services spotted in managed IAM policies ahead of re:Invent, season by season, with the launches they turned into.",
  path: "/reinvent",
});

const PREVIEW = 6;
const ARCHIVE_NAMES = 4;

function serviceLabel(service: ReinventService): string {
  return service.name ?? service.prefix;
}

/** The services a season gave away before the conference opened. */
function earlyServices(edition: ReinventEdition): ReinventService[] {
  return spottedServices(edition)
    .filter((service) => service.timing === "before")
    .sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
}

function ArchiveCard({ edition }: { edition: ReinventEdition }) {
  const when = conferenceLabel(edition.conference);
  const early = earlyServices(edition);
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

        {early.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-mono uppercase tracking-wider text-amber-300">
              {edition.services.some((service) => service.kind !== null)
                ? "Spotted before the keynote"
                : "New in IAM before the keynote"}
            </p>
            <p className="mt-1 text-sm text-zinc-200 leading-relaxed">
              {early.slice(0, ARCHIVE_NAMES).map((service, index) => (
                <span key={service.prefix}>
                  {index > 0 ? ", " : null}
                  {serviceLabel(service)}{" "}
                  <span className="text-xs font-mono text-zinc-500">
                    {formatDay(service.firstSeen).replace(/, \d{4}$/, "")}
                  </span>
                </span>
              ))}
              {early.length > ARCHIVE_NAMES
                ? `, and ${early.length - ARCHIVE_NAMES} more`
                : null}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            No new service prefix before the keynote.
          </p>
        )}

        <p className="mt-3 text-xs text-zinc-400">
          {plural(edition.services.length, "new service prefix", "new service prefixes")},{" "}
          {plural(edition.neverBeforeSeen, "never-before-seen action")}
          {pre && pre.length > 0
            ? `, ${plural(pre.length, "pre-re:Invent launch", "pre-re:Invent launches")}`
            : ""}
          .
        </p>
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

function SpottedPreview({ edition }: { edition: ReinventEdition }) {
  const spotted = [...spottedServices(edition)].sort(
    (a, b) => b.firstSeen.localeCompare(a.firstSeen) || a.prefix.localeCompare(b.prefix),
  );
  const shown = spotted.slice(0, PREVIEW);
  if (shown.length === 0) {
    return (
      <p className="text-sm text-zinc-300">
        No brand-new service in a managed policy yet this season.
      </p>
    );
  }
  return (
    <div>
      <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-amber-300">
        Spotted in IAM so far
      </h2>
      <ul className="mt-2 divide-y divide-amber-400/15 border border-amber-400/25 rounded-lg bg-black/40">
        {shown.map((service) => (
          <li
            key={service.prefix}
            className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
          >
            <span className="min-w-0">
              <span className="text-sm text-amber-100">{serviceLabel(service)}</span>{" "}
              <code className="text-xs font-mono text-zinc-500">{service.prefix}</code>
            </span>
            <span className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              {service.spottedFirst ? (
                <span className="px-1.5 py-0.5 rounded border border-emerald-500/50 bg-emerald-400/15 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
                  Before AWS docs
                </span>
              ) : null}
              {service.announcement ? (
                <span className="text-zinc-300">announced</span>
              ) : null}
              {formatDay(service.firstSeen)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={`/reinvent/${edition.year}`}
        className="mt-2 inline-flex items-center gap-1 text-sm font-mono text-amber-300 hover:text-white"
      >
        {spotted.length > shown.length
          ? `All ${spotted.length} with their actions and announcements`
          : "Actions, docs dates and announcements"}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
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
  const countdown = current ? countdownLabel(current, archive.generatedAt) : null;

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
              AWS wires up a new service&apos;s permissions in its managed
              policies before launch day. IAMTrail watches those policies every
              hour, so new services show up here before the keynote, often
              before AWS documents them.
            </p>
          </div>

          {current ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-white">
                    re:Invent {current.year}
                    {countdown ? (
                      <span className="ml-3 text-sm text-amber-300">{countdown}</span>
                    ) : null}
                  </p>
                  {current.conference ? (
                    <p className="mt-0.5 text-xs font-mono text-zinc-400">
                      {conferenceLabel(current.conference)}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/reinvent/${current.year}`}
                  className="inline-flex items-center gap-1 text-sm font-medium font-mono text-amber-300 hover:text-white"
                >
                  Full season
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-base text-zinc-100 max-w-3xl">
                {seasonLead(current, archive.generatedAt)}
              </p>
              <SpottedPreview edition={current} />
              <ReinventStats edition={current} tone="vegas" />
              <OfficialLinks edition={current} />
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
        <div>
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            {current ? "Previous seasons" : "Archive"}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            What each season gave away in IAM before the keynote.
          </p>
        </div>
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
