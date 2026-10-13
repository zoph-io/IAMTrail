import Link from "next/link";
import { iamActionToSlug } from "@/lib/actionSlug";
import { plural } from "@/lib/changes";
import {
  conferenceLabel,
  endpointTotal,
  formatDay,
  timingLabel,
  type ReinventAction,
  type ReinventEdition,
  type ReinventFile,
} from "@/lib/reinvent";

const SHOWN_ACTIONS = 8;

function ActionList({ actions }: { actions: ReinventAction[] }) {
  const shown = actions.slice(0, SHOWN_ACTIONS);
  const left = actions.length - shown.length;
  return (
    <p className="mt-1.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 leading-relaxed break-words">
      {shown.map((action, index) => (
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

function TimingBadge({ timing }: { timing: ReinventEdition["services"][number]["timing"] }) {
  const label = timingLabel(timing);
  if (!label) return null;
  const tone =
    timing === "before"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : timing === "during"
        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest rounded ${tone}`}
    >
      {label}
    </span>
  );
}

export function ReinventStats({ edition }: { edition: ReinventEdition }) {
  const stats = [
    { label: "New AWS services", value: edition.services.length },
    { label: "Never-before-seen actions", value: edition.neverBeforeSeen },
    { label: "Policy changes", value: edition.changes },
    { label: "Endpoint changes", value: endpointTotal(edition) },
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white dark:bg-zinc-900 px-4 py-3">
          <dt className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {stat.label}
          </dt>
          <dd className="mt-1 text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-white">
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
    { href: edition.whatsNew, label: `What's New, ${edition.year}` },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 dark:text-red-400 hover:underline font-medium"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function seasonLead(edition: ReinventEdition, generatedAt: string): string {
  const asOf = generatedAt.slice(0, 10);
  const opens = edition.conference?.starts;
  const conferenceStarted = Boolean(opens && asOf >= opens);
  if (edition.services.length === 0) {
    return edition.status === "open"
      ? "No new AWS service spotted in this season yet. A new prefix usually shows up in a managed policy before AWS announces it."
      : "No new AWS service showed up in a managed policy during this season.";
  }
  if (edition.beforeConference > 0 && opens && conferenceStarted) {
    return `${plural(edition.beforeConference, "new AWS service")} showed up in a managed policy before the conference opened on ${formatDay(opens)}.`;
  }
  if (edition.beforeConference > 0 && opens && !conferenceStarted) {
    return `${plural(edition.services.length, "new AWS service")} already in IAM. The conference opens ${formatDay(opens)}.`;
  }
  return `${plural(edition.services.length, "new AWS service")} first appeared in a managed policy during this season.`;
}

function PolicyLink({ name }: { name: string }) {
  return (
    <Link
      href={`/policies/${encodeURIComponent(name)}`}
      className="font-mono text-red-600 dark:text-red-400 hover:underline"
    >
      {name}
    </Link>
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
  const guarddutyLeft = edition.guardduty.total - edition.guardduty.items.length;

  return (
    <div className="space-y-8">
      <div className="py-8 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
          <Link href="/reinvent" className="hover:text-red-600 dark:hover:text-red-400">
            re:Invent
          </Link>
          {edition.status === "open" ? " / this season" : " / archive"}
        </p>
        <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mb-2">
          re:Invent {edition.year}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
          {when ? `${when}. ` : null}
          What the archive caught from {archive.windowLabel}: new
          AWS services, never-before-seen actions, and the endpoint changes
          beside them. The announcement roundup is what AWS published.
        </p>
        <div className="mt-4">
          <OfficialLinks edition={edition} />
        </div>
      </div>

      <ReinventStats edition={edition} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
        {seasonLead(edition, archive.generatedAt)}
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
          New AWS services
        </h2>
        {edition.services.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No new AWS service spotted in this season yet.
          </p>
        ) : (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {edition.services.map((service) => (
              <div key={service.prefix} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <code className="font-mono font-semibold text-sm text-zinc-900 dark:text-white">
                      {service.prefix}
                    </code>
                    {service.name ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {service.name}
                      </span>
                    ) : null}
                    <TimingBadge timing={service.timing} />
                  </div>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {formatDay(service.firstSeen)} /{" "}
                    {plural(service.actions.length, "action")}
                  </span>
                </div>
                {service.firstPolicy ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    First seen in <PolicyLink name={service.firstPolicy} />
                  </p>
                ) : null}
                {service.actions.length > 0 ? (
                  <ActionList actions={service.actions} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {edition.actionGroups.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            Never-before-seen actions on existing services
          </h2>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {edition.actionGroups.map((group) => (
              <div key={group.prefix} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <code className="font-mono font-semibold text-sm text-zinc-900 dark:text-white">
                      {group.prefix}
                    </code>
                    {group.name ? (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {" "}
                        {group.name}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {formatDay(group.firstSeen)} /{" "}
                    {plural(group.actions.length, "never-before-seen action")}
                  </span>
                </div>
                {group.firstPolicy ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    First of them in <PolicyLink name={group.firstPolicy} />
                  </p>
                ) : null}
                <ActionList actions={group.actions} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {edition.permissionsManagement.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            Permissions management
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {plural(edition.permissionsManagement.length, "never-before-seen action")}{" "}
            classified as permissions management.
          </p>
          <ActionList actions={edition.permissionsManagement} />
        </section>
      ) : null}

      {edition.newPolicies.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            New policies
          </h2>
          <ul className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
            {edition.newPolicies.map((policy) => (
              <li
                key={policy.name}
                className="px-5 py-3 flex flex-wrap items-baseline justify-between gap-2"
              >
                <PolicyLink name={policy.name} />
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {formatDay(policy.firstSeen)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {endpointTotal(edition) > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            Endpoint changes
          </h2>
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
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            GuardDuty announcements
          </h2>
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
