import Link from "next/link";
import { iamActionToSlug } from "@/lib/actionSlug";
import { plural } from "@/lib/changes";
import VegasFrame from "@/components/VegasFrame";
import {
  conferenceLabel,
  conferenceStatus,
  endpointTotal,
  existingServices,
  formatDay,
  leadDays,
  spottedServices,
  timingLabel,
  type ReinventAction,
  type ReinventEdition,
  type ReinventFile,
  type ReinventService,
  type WhatsNewPost,
} from "@/lib/reinvent";

const SHOWN_ACTIONS = 8;

function ActionList({ actions, shown = SHOWN_ACTIONS }: { actions: ReinventAction[]; shown?: number }) {
  const list = actions.slice(0, shown);
  const left = actions.length - list.length;
  return (
    <p className="mt-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 leading-relaxed break-words">
      {list.map((action, index) => (
        <span key={action.action}>
          {index > 0 ? ", " : null}
          {action.hasPage ? (
            <Link
              href={`/actions/${iamActionToSlug(action.action)}`}
              className="hover:text-red-600 dark:hover:text-red-400"
            >
              {action.action}
            </Link>
          ) : (
            action.action
          )}
        </span>
      ))}
      {left > 0 ? ` and ${left} more` : null}
    </p>
  );
}

function Badge({ tone, children }: { tone: "amber" | "fuchsia" | "cyan" | "emerald" | "zinc"; children: React.ReactNode }) {
  const tones = {
    amber: "bg-amber-400/15 text-amber-800 border-amber-400/50 dark:text-amber-200",
    fuchsia: "bg-fuchsia-400/15 text-fuchsia-800 border-fuchsia-400/50 dark:text-fuchsia-200",
    cyan: "bg-cyan-400/10 text-cyan-800 border-cyan-400/40 dark:text-cyan-200",
    emerald: "bg-emerald-400/15 text-emerald-800 border-emerald-500/50 dark:text-emerald-200",
    zinc: "bg-zinc-400/10 text-zinc-700 border-zinc-400/40 dark:text-zinc-300",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest rounded border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function TimingBadge({ timing }: { timing: ReinventService["timing"] }) {
  const label = timingLabel(timing);
  if (!label) return null;
  return (
    <Badge tone={timing === "before" ? "amber" : timing === "during" ? "fuchsia" : "cyan"}>
      {label}
    </Badge>
  );
}

/** "Opens in 8 days", "Day 2 of 5", or nothing once it is over. */
export function countdownLabel(edition: ReinventEdition, generatedAt: string): string | null {
  const status = conferenceStatus(edition, generatedAt);
  if (!status || !edition.conference) return null;
  if (status.phase === "upcoming") {
    return status.days === 1 ? "Opens tomorrow" : `Opens in ${status.days} days`;
  }
  if (status.phase === "live") {
    const length =
      Math.round(
        (Date.parse(edition.conference.ends) - Date.parse(edition.conference.starts)) /
          86_400_000,
      ) + 1;
    return `Live now, day ${status.days} of ${length}`;
  }
  return null;
}

export function ReinventStats({
  edition,
  tone = "plain",
}: {
  edition: ReinventEdition;
  tone?: "plain" | "vegas";
}) {
  const classified = edition.services.some((service) => service.kind !== null);
  const pre = edition.whatsNewPosts.available
    ? edition.whatsNewPosts.items.filter((post) => post.timing === "before").length
    : null;
  const stats = [
    classified
      ? { label: "Brand-new services", value: spottedServices(edition).length }
      : { label: "New service prefixes", value: edition.services.length },
    { label: "Never-before-seen actions", value: edition.neverBeforeSeen },
    { label: "New managed policies", value: edition.newPolicies.length },
    pre === null
      ? { label: "Policy changes", value: edition.changes }
      : { label: "Pre-re:Invent launches", value: pre },
  ];
  const vegas = tone === "vegas";
  return (
    <dl
      className={
        vegas
          ? "grid grid-cols-2 lg:grid-cols-4 gap-px bg-amber-400/20 border border-amber-400/30 rounded-lg overflow-hidden"
          : "grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
      }
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={vegas ? "bg-black/50 px-4 py-3" : "bg-white dark:bg-zinc-900 px-4 py-3"}
        >
          <dt className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {stat.label}
          </dt>
          <dd
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              vegas ? "text-amber-300" : "text-zinc-900 dark:text-white"
            }`}
          >
            {stat.value.toLocaleString("en-US")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function OfficialLinks({
  edition,
}: {
  edition: ReinventEdition;
}) {
  const links = [
    edition.roundup
      ? { href: edition.roundup.url, label: edition.roundup.title }
      : null,
    edition.eventUrl ? { href: edition.eventUrl, label: "re:Invent event" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 hover:text-white hover:underline font-medium"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One plain sentence on what this season has given away so far. */
export function seasonLead(edition: ReinventEdition, generatedAt: string): string {
  const spotted = spottedServices(edition);
  const classified = edition.services.some((service) => service.kind !== null);
  const first = spotted.filter((service) => service.spottedFirst).length;
  const pre = spotted.filter((service) => service.timing === "before").length;
  const status = conferenceStatus(edition, generatedAt);
  const noun = classified ? "brand-new AWS service" : "new service prefix";

  if (spotted.length === 0) {
    return edition.status === "open"
      ? "No brand-new AWS service has shown up in a managed policy yet. New prefixes usually land in the weeks before the keynote."
      : `No ${noun} showed up in a managed policy this season.`;
  }
  const parts = [`${plural(spotted.length, noun)} showed up in AWS managed policies this season`];
  if (first > 0) {
    parts[0] += `, ${first} of them before AWS's own IAM reference listed ${first === 1 ? "it" : "them"}`;
  } else if (status && status.phase !== "upcoming" && pre > 0) {
    parts[0] += `, ${pre} before the conference opened`;
  }
  return `${parts[0]}.`;
}

/* ---------------------------------------------------------------- spotted */

function SpottedCard({ service, open }: { service: ReinventService; open: boolean }) {
  const lead = leadDays(service);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900 dark:text-white">
            {service.name ?? service.prefix}
          </p>
          <code className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {service.prefix}:*
          </code>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {service.spottedFirst ? <Badge tone="emerald">Before AWS docs</Badge> : null}
          <TimingBadge timing={service.timing} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pt-0.5">
          Spotted
        </dt>
        <dd className="text-zinc-700 dark:text-zinc-300">
          {formatDay(service.firstSeen)} in <PolicyLink name={service.firstPolicy} />
        </dd>
        {service.kind === "new" ? (
          <>
            <dt className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pt-0.5">
              AWS docs
            </dt>
            <dd className="text-zinc-700 dark:text-zinc-300">
              {service.docsSince
                ? service.spottedFirst
                  ? `Listed ${formatDay(service.docsSince)}, ${plural(
                      Math.round(
                        (Date.parse(service.docsSince) - Date.parse(service.firstSeen)) /
                          86_400_000,
                      ),
                      "day",
                    )} after IAMTrail saw it`
                  : `Listed ${formatDay(service.docsSince)}`
                : "Not in the IAM reference yet"}
            </dd>
          </>
        ) : null}
        {service.announcement || open ? (
          <dt className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pt-0.5">
            Announced
          </dt>
        ) : null}
        <dd className="text-zinc-700 dark:text-zinc-300 empty:hidden">
          {service.announcement ? (
            <>
              <a
                href={service.announcement.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                {service.announcement.headline}
              </a>{" "}
              <span className="text-xs font-mono text-zinc-500">
                {formatDay(service.announcement.date)}
                {lead !== null && lead > 0 ? `, ${plural(lead, "day")} after the IAM sighting` : ""}
              </span>
            </>
          ) : open ? (
            <span className="text-zinc-500 dark:text-zinc-400">
              No What&apos;s New post yet. One to watch.
            </span>
          ) : null}
        </dd>
      </dl>

      {service.actions.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {plural(service.actions.length, "action")} so far
          </p>
          <ActionList actions={service.actions} shown={6} />
        </div>
      ) : null}
    </li>
  );
}

function SpottedSection({ edition }: { edition: ReinventEdition }) {
  const spotted = [...spottedServices(edition)].sort(
    (a, b) =>
      Number(b.spottedFirst) - Number(a.spottedFirst) ||
      b.firstSeen.localeCompare(a.firstSeen) ||
      a.prefix.localeCompare(b.prefix),
  );
  const classified = edition.services.some((service) => service.kind !== null);
  const open = edition.status === "open";
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
        {open ? "Spotted in IAM, ahead of the keynote" : "Spotted in IAM"}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
        AWS adds a service&apos;s permissions to its managed policies before
        launch day, so a new prefix there is often the first public trace of a
        new service.{" "}
        {classified
          ? "These prefixes were not in AWS's IAM reference before this season."
          : "This season predates IAMTrail's docs history, so every new prefix is listed."}
      </p>
      {spotted.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {open ? "Nothing brand-new yet this season." : "Nothing brand-new this season."}
        </p>
      ) : (
        <ul className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {spotted.map((service) => (
            <SpottedCard key={service.prefix} service={service} open={open} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExistingSection({ edition }: { edition: ReinventEdition }) {
  const existing = existingServices(edition);
  if (existing.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
        First time in a managed policy
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
        Existing AWS services that AWS already documented, now granted by a
        managed policy for the first time. Not new services, but a sign of
        where integrations are going.
      </p>
      <ul className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
        {existing.map((service) => (
          <li
            key={service.prefix}
            className="px-5 py-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
          >
            <span className="min-w-0">
              <span className="text-zinc-900 dark:text-white">{service.name ?? service.prefix}</span>{" "}
              <code className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                {service.prefix}
              </code>
            </span>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {formatDay(service.firstSeen)} in <PolicyLink name={service.firstPolicy} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- what's new */

const HEADLINERS = 5;

function PostRow({ post }: { post: WhatsNewPost }) {
  return (
    <li className="px-5 py-3">
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-zinc-800 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400 hover:underline"
      >
        {post.headline}
      </a>
      <p className="mt-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        {formatDay(post.date)}
      </p>
    </li>
  );
}

function PostList({ posts }: { posts: WhatsNewPost[] }) {
  const shown = posts.slice(0, HEADLINERS);
  const rest = posts.slice(HEADLINERS);
  return (
    <div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {shown.map((post) => (
          <PostRow key={post.url} post={post} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <details className="border-t border-zinc-100 dark:border-zinc-800">
          <summary className="cursor-pointer px-5 py-3 text-sm font-mono text-red-600 dark:text-red-400">
            {plural(rest.length, "more announcement")}
          </summary>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
            {rest.map((post) => (
              <PostRow key={post.url} post={post} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function WhatsNewSection({ edition }: { edition: ReinventEdition }) {
  const groups = [
    { title: "Pre-re:Invent", timing: "before" },
    { title: "During the conference", timing: "during" },
    { title: "After the conference", timing: "after" },
    { title: "This season", timing: null },
  ]
    .map((group) => ({
      title: group.title,
      items: edition.whatsNewPosts.items.filter((post) => post.timing === group.timing),
    }))
    .filter((group) => group.items.length > 0)
    // The conference's own launches lead once it has started.
    .sort((a, b) => Number(b.title === "During the conference") - Number(a.title === "During the conference"));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
        {edition.status === "open" ? "Announced so far" : "What's New"}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
        Major launch posts from AWS What&apos;s New this season, newest first.
        Regional rollouts and small feature notes are left out.
      </p>
      {!edition.whatsNewPosts.available ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">What&apos;s New data unavailable.</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {edition.status === "open"
            ? "No major What's New post in this season yet."
            : "No major What's New post in this season."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.title}
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900"
            >
              <div className="px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-baseline justify-between gap-3">
                <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                  {group.title}
                </h3>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {plural(group.items.length, "announcement")}
                </span>
              </div>
              <PostList posts={group.items} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PolicyLink({ name }: { name: string }) {
  return (
    <Link
      href={`/policies/${encodeURIComponent(name)}`}
      className="font-mono text-red-600 dark:text-red-400 hover:underline break-all"
    >
      {name}
    </Link>
  );
}

// The 2026 season reached 118 services and 43 policies a week before the
// conference, which made this page ~20,000px tall. Lead with the busiest and
// newest, and fold the long tail.
const SHOWN_GROUPS = 10;
const SHOWN_POLICIES = 10;

function NewPolicyRow({ policy }: { policy: { name: string; firstSeen: string } }) {
  return (
    <li className="px-5 py-3 flex flex-wrap items-baseline justify-between gap-2">
      <PolicyLink name={policy.name} />
      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
        {formatDay(policy.firstSeen)}
      </span>
    </li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
      {children}
    </h2>
  );
}

export default function ReinventEditionView({
  edition,
  archive,
}: {
  edition: ReinventEdition;
  archive: ReinventFile;
}) {
  const when = conferenceLabel(edition.conference);
  const countdown = edition.status === "open" ? countdownLabel(edition, archive.generatedAt) : null;
  const guarddutyLeft = edition.guardduty.total - edition.guardduty.items.length;
  const actionGroups = [...edition.actionGroups].sort(
    (a, b) => b.actions.length - a.actions.length || a.prefix.localeCompare(b.prefix),
  );
  const topGroups = actionGroups.slice(0, SHOWN_GROUPS);
  const otherGroups = actionGroups.slice(SHOWN_GROUPS);

  return (
    <div className="space-y-10">
      <VegasFrame>
        <div className="px-5 py-6 sm:px-6 space-y-5">
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-amber-300/80 mb-2">
              <Link href="/reinvent" className="hover:text-white">
                re:Invent
              </Link>
              {edition.status === "open" ? " / this season" : " / archive"}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-2xl font-bold font-mono text-white">re:Invent {edition.year}</h1>
              {countdown ? (
                <span className="text-sm font-mono font-semibold text-amber-300">{countdown}</span>
              ) : null}
            </div>
            {when ? <p className="mt-1 text-xs font-mono text-zinc-400">{when}</p> : null}
            <p className="mt-3 text-base text-zinc-100 max-w-3xl leading-relaxed">
              {seasonLead(edition, archive.generatedAt)}
            </p>
            <p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">
              IAMTrail watches every AWS managed policy hour by hour. The season
              runs {archive.windowLabel}, because AWS ships most of the IAM
              groundwork in the weeks before the conference.
            </p>
            <div className="mt-4">
              <OfficialLinks edition={edition} />
            </div>
          </div>
          <ReinventStats edition={edition} tone="vegas" />
        </div>
      </VegasFrame>

      <SpottedSection edition={edition} />

      {actionGroups.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Where AWS is building</SectionTitle>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
            {plural(actionGroups.length, "existing service")} gained
            never-before-seen actions this season. A burst of new actions on one
            service usually means a feature launch is close.
          </p>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {topGroups.map((group) => (
              <div key={group.prefix} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {group.name ?? group.prefix}
                    </span>{" "}
                    <code className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {group.prefix}
                    </code>
                  </div>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {plural(group.actions.length, "new action")}
                  </span>
                </div>
                <ActionList actions={group.actions} shown={6} />
              </div>
            ))}
            {otherGroups.length > 0 ? (
              <details>
                <summary className="cursor-pointer px-5 py-3 text-sm font-mono text-red-600 dark:text-red-400">
                  {plural(otherGroups.length, "more service")}
                </summary>
                <ul className="flex flex-wrap gap-2 px-5 pb-4">
                  {otherGroups.map((group) => (
                    <li
                      key={group.prefix}
                      title={group.actions.map((a) => a.action).join(", ")}
                      className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300"
                    >
                      {group.prefix}{" "}
                      <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {group.actions.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      <WhatsNewSection edition={edition} />

      <ExistingSection edition={edition} />

      {edition.permissionsManagement.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Permissions management</SectionTitle>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {plural(edition.permissionsManagement.length, "never-before-seen action")}{" "}
            can change who has access to what. Worth a look before you attach
            the policies that grant them.
          </p>
          <ActionList actions={edition.permissionsManagement} />
        </section>
      ) : null}

      {edition.newPolicies.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle>New managed policies</SectionTitle>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {edition.newPolicies.slice(0, SHOWN_POLICIES).map((policy) => (
                <NewPolicyRow key={policy.name} policy={policy} />
              ))}
            </ul>
            {edition.newPolicies.length > SHOWN_POLICIES ? (
              <details className="border-t border-zinc-100 dark:border-zinc-800">
                <summary className="cursor-pointer px-5 py-3 text-sm font-mono text-red-600 dark:text-red-400">
                  {plural(edition.newPolicies.length - SHOWN_POLICIES, "more policy", "more policies")}
                </summary>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
                  {edition.newPolicies.slice(SHOWN_POLICIES).map((policy) => (
                    <NewPolicyRow key={policy.name} policy={policy} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {endpointTotal(edition) > 0 ? (
        <section className="space-y-3">
          <SectionTitle>Endpoint changes</SectionTitle>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            From botocore, separate from the IAM prefixes above.{" "}
            <Link
              href="/endpoints"
              className="text-red-600 dark:text-red-400 hover:underline font-medium"
            >
              All endpoint changes
            </Link>
            .
          </p>
          {edition.endpoints.newRegions.length > 0 ? (
            <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
              {edition.endpoints.newRegions.map((region) => (
                <li key={region.id}>
                  <span className="font-mono">{region.id}</span>
                  {region.description && region.description !== region.id
                    ? ` ${region.description}`
                    : null}{" "}
                  <span className="text-xs font-mono text-zinc-500">
                    {formatDay(region.detectedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {edition.endpoints.newServices.length > 0 ? (
            <ul className="text-sm font-mono text-zinc-700 dark:text-zinc-300 space-y-1">
              {edition.endpoints.newServices.map((service) => (
                <li key={service.id}>
                  {service.id}{" "}
                  <span className="text-xs text-zinc-500">
                    {formatDay(service.detectedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {edition.endpoints.expansions > 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {plural(edition.endpoints.expansions, "service expansion")}.
            </p>
          ) : null}
        </section>
      ) : null}

      {edition.guardduty.total > 0 ? (
        <section className="space-y-3">
          <SectionTitle>GuardDuty announcements</SectionTitle>
          <ul className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {edition.guardduty.items.map((item) => (
              <li key={`${item.detectedAt}:${item.title}`} className="px-5 py-3">
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-red-600 dark:hover:text-red-400"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </p>
                <p className="mt-0.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {formatDay(item.detectedAt)}
                </p>
              </li>
            ))}
          </ul>
          {guarddutyLeft > 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              And {plural(guarddutyLeft, "more announcement")} on{" "}
              <Link
                href="/guardduty"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                GuardDuty
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm">
              <Link
                href="/guardduty"
                className="text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                All GuardDuty announcements
              </Link>
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
