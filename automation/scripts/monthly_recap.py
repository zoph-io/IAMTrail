#!/usr/bin/env python3
"""Draft the "AWS managed policy changes" post for zoph.me, for a month or a longer period.

Replays the archive with build_action_registry.build(), keeps the deltas that
fall in the chosen calendar months (UTC), and renders a short Hugo post (about
TARGET_WORDS words once written): the numbers table, the new service prefixes
and links to iamtrail.com for the full lists. The long lists (biggest updates,
new policies, wildcards, rollbacks...) go to a fact sheet comment the author
picks two or three stories from. The parts that need an opinion are left as
HTML comments: Hugo drops raw HTML, so a TODO that survives renders nothing.

The post is always written with draft: true. Run it after the month closes;
running it mid-month works but covers the month to date only.

    python3 automation/scripts/monthly_recap.py --month 2026-09 \
        --out-dir ../weblog/content/posts

or `make monthly-recap MONTH=2026-09 OUT=../weblog/content/posts`.

A season is a range with a label, compared with the same months a year earlier:

    python3 automation/scripts/monthly_recap.py --month 2026-06 --to 2026-09 \
        --label "Summer 2026" --out-dir ../weblog/content/posts

Stdlib only, like build_action_registry.py.
"""

import argparse
import contextlib
import datetime as dt
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_action_registry as registry  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_URL = "https://iamtrail.com"
AUTHOR_TZ = ZoneInfo("Europe/Paris")

# Same threshold as buildPolicyHistory in website/scripts/generate-data.js: a
# day where more than this many policies changed was a reformat of the archive,
# not AWS publishing new versions.
BULK_DAY_THRESHOLD = 50

# The post is a digest of about this many words; the long lists go to a comment
# for the author (the fact sheet) and readers get a link to iamtrail.com/changes.
TARGET_WORDS = 500
MAX_PREFIXES = 8
TOP_UPDATES = 8
TOP_NEW_POLICIES = 5
MAX_LISTED_ACTIONS = 5
TOP_NEW_ACTION_SERVICES = 6
MIN_VERSIONS_MOST_ACTIVE = 3
# Policies attached to a lot of humans and vendors: a change there matters to almost everyone.
WATCHED = ["AdministratorAccess", "PowerUserAccess", "ReadOnlyAccess", "ViewOnlyAccess", "SecurityAudit"]


def git_doc(rev, path):
    """The policy document at rev, or None when the path did not exist there."""
    result = subprocess.run(
        ["git", "show", f"{rev}:{path}"], capture_output=True, text=True
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def allowed_wildcards(doc):
    """Wildcard actions granted by Allow statements, keyed lowercase.

    A new `service:*` or `service:Get*` in an Allow is the change most worth a
    security reviewer's attention, and the literal-action deltas cannot see it.
    """
    found = {}
    for stmt in registry.statements(doc or {}):
        if stmt.get("Effect") != "Allow":
            continue
        values = stmt.get("Action")
        if isinstance(values, str):
            values = [values]
        for value in values if isinstance(values, list) else []:
            if isinstance(value, str) and "*" in value:
                found[value.lower()] = value
    return found


def month_bounds(month):
    start = dt.datetime.strptime(month, "%Y-%m").replace(tzinfo=dt.timezone.utc)
    end = (start + dt.timedelta(days=32)).replace(day=1)
    return start, end


def previous_month(month):
    start, _ = month_bounds(month)
    return (start - dt.timedelta(days=1)).strftime("%Y-%m")


def month_range(first, last):
    months = [first]
    while months[-1] < last:
        months.append(month_bounds(months[-1])[1].strftime("%Y-%m"))
    return months


def comparison_months(months):
    """A single month is compared with the one before; a longer period with the same months a year earlier."""
    if len(months) == 1:
        return [previous_month(months[0])]
    return [f"{int(m[:4]) - 1}{m[4:]}" for m in months]


def range_text(months, short=False):
    fmt = "%b" if short else "%B"
    first, last = month_bounds(months[0])[0], month_bounds(months[-1])[0]
    if len(months) == 1:
        return first.strftime(f"{fmt} %Y")
    if first.year == last.year:
        return f"{first.strftime(fmt)} to {last.strftime(f'{fmt} %Y')}"
    return f"{first.strftime(f'{fmt} %Y')} to {last.strftime(f'{fmt} %Y')}"


def in_period(deltas, months):
    """Deltas dated in the given months, oldest first, with bulk-reformat days split out."""
    wanted = set(months)
    rows = sorted((d for d in deltas if d["date"][:7] in wanted), key=lambda d: d["date"])
    per_day = defaultdict(set)
    for d in rows:
        if d["status"] == "modified":
            per_day[d["date"][:10]].add(d["policyName"])
    bulk = {day for day, names in per_day.items() if len(names) > BULK_DAY_THRESHOLD}
    kept = [d for d in rows if not (d["status"] == "modified" and d["date"][:10] in bulk)]
    return kept, sorted(bulk)


def mark_repeated_versions(deltas):
    """Flag deltas whose VersionId equals the policy's previous one (a re-fetch, not a release)."""
    last = {}
    for d in reversed(deltas):
        name = d["policyName"]
        d["repeatVersion"] = d["status"] == "modified" and d["versionId"] == last.get(name)
        last[name] = None if d["status"] == "removed" else d["versionId"]


def net_changes(rows):
    """Per policy: versions, first and last sha, and the net action diff for the month.

    Composed version by version so an action added and then removed again in the
    same month does not show up on either side.
    """
    policies = {}
    for d in rows:
        if d["status"] != "modified":
            continue
        p = policies.setdefault(d["policyName"], {
            "versions": [], "sequence": [], "first_sha": d["sha"], "last_sha": d["sha"],
            "added": {}, "removed": {},
        })
        if d["versionId"] and not d.get("repeatVersion"):
            # AWS can set an older version back as the default, so the sequence may revisit an ID.
            p["sequence"].append(d["versionId"])
            if d["versionId"] not in p["versions"]:
                p["versions"].append(d["versionId"])
        p["last_sha"] = d["sha"]
        for a in d["actionsAdded"]:
            if a.lower() in p["removed"]:
                del p["removed"][a.lower()]
            else:
                p["added"][a.lower()] = a
        for a in d["actionsRemoved"]:
            if a.lower() in p["added"]:
                del p["added"][a.lower()]
            else:
                p["removed"][a.lower()] = a
    return policies


def summarize(deltas, months):
    rows, bulk_days = in_period(deltas, months)
    added = [d for d in rows if d["status"] == "added"]
    added_names = {d["policyName"] for d in added}
    removed = [d for d in rows if d["status"] == "removed"]
    modified = {
        name: p for name, p in net_changes(rows).items()
        if name not in added_names and (p["versions"] or p["added"] or p["removed"])
    }
    new_actions = {}
    new_prefixes = []
    for d in rows:
        for a in d["newActions"]:
            new_actions.setdefault(a.lower(), (a, d["policyName"]))
        for s in d["newServicePrefixes"]:
            new_prefixes.append((s, d["policyName"], d["date"]))
    return {
        "months": months,
        "rows": rows,
        "bulk_days": bulk_days,
        "added": added,
        "removed": removed,
        "modified": modified,
        "versions": sum(len(p["versions"]) for p in modified.values()),
        "actions_added": sum(len(p["added"]) for p in modified.values()),
        "actions_removed": sum(len(p["removed"]) for p in modified.values()),
        "new_actions": new_actions,
        "new_prefixes": new_prefixes,
    }


def wildcard_changes(summary):
    """Allow wildcards that appeared during the month, per policy."""
    out = []
    for name, p in summary["modified"].items():
        path = f"{registry.POLICY_PREFIX}{name}"
        before = allowed_wildcards(git_doc(f"{p['first_sha']}^", path))
        after = allowed_wildcards(git_doc(p["last_sha"], path))
        gained = [after[k] for k in sorted(after.keys() - before.keys())]
        if gained:
            out.append((name, gained, False))
    for d in summary["added"]:
        path = f"{registry.POLICY_PREFIX}{d['policyName']}"
        gained = sorted(allowed_wildcards(git_doc(d["sha"], path)).values())
        if gained:
            out.append((d["policyName"], gained, True))
    return sorted(out, key=lambda item: item[0].lower())


def code_list(items, limit=MAX_LISTED_ACTIONS):
    text = ", ".join(f"`{a}`" for a in items[:limit])
    if len(items) > limit:
        text += f" and {len(items) - limit:,} more"
    return text


def day(date):
    return dt.datetime.strptime(date[:10], "%Y-%m-%d").strftime("%b %-d")


def plural(count, word):
    return f"{count:,} {word}{'' if count == 1 else 's'}"


def comment_safe(text):
    """An HTML comment ends at the first `--`, so keep it out of the fact sheet."""
    return text.replace("--", "- -")


def visible_words(text):
    """Words a reader sees: body only, without HTML comments, code blocks and link targets."""
    body = text.split("\n---\n", 1)[-1]
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    body = re.sub(r"```.*?```", " ", body, flags=re.S)
    body = re.sub(r"\]\([^)]*\)", "]", body)
    return len(re.findall(r"[A-Za-z0-9][\w'.,:%/-]*", body))


def fact_sheet(summary, label, service):
    """The long lists, as notes for the author: the post itself only keeps two or three of them."""
    notes = []

    def section(title, lines):
        if lines:
            notes.extend(["", f"{title}:"] + [f"  - {line}" for line in lines])

    modified = summary["modified"]
    section("Widely attached policies that changed", [
        f"{name} ({plural(len(modified[name]['versions']), 'version')}): +{len(modified[name]['added']):,} / "
        f"-{len(modified[name]['removed']):,}, like {code_list(sorted(modified[name]['added'].values()), 3)}"
        for name in WATCHED if name in modified
    ])

    ranked = sorted(
        ((name, p) for name, p in modified.items() if p["added"] or p["removed"]),
        key=lambda item: (-(len(item[1]["added"]) + len(item[1]["removed"])), item[0].lower()),
    )
    section("Biggest updates", [
        f"{name}: +{len(p['added']):,} / -{len(p['removed']):,}" for name, p in ranked[:TOP_UPDATES]
    ])

    section("Largest new policies", [
        f"{d['policyName']} ({day(d['date'])}): {len(d['actionsAdded']):,} actions"
        for d in sorted(summary["added"], key=lambda d: -len(d["actionsAdded"]))[:TOP_NEW_POLICIES]
    ])

    wildcards = [
        (name, [w for w in gained if w.endswith(":*") or w == "*"], is_new)
        for name, gained, is_new in wildcard_changes(summary)
    ]
    section("New service-wide wildcards (service:*) in Allow statements", [
        f"{name} ({'new' if is_new else 'updated'}): {code_list(gained)}"
        for name, gained, is_new in wildcards if gained
    ])

    section("Rolled back (AWS set an older version as default again)", [
        f"{name}: {' > '.join(p['sequence'])}" for name, p in modified.items()
        if p["sequence"] and p["sequence"][-1] in p["sequence"][:-1]
    ])

    busy = sorted(
        ((name, len(p["versions"])) for name, p in modified.items()
         if len(p["versions"]) >= MIN_VERSIONS_MOST_ACTIVE),
        key=lambda item: (-item[1], item[0].lower()),
    )
    section("Most active", [f"{name}: {plural(count, 'version')}" for name, count in busy[:TOP_UPDATES]])

    by_service = defaultdict(int)
    for action, _ in summary["new_actions"].values():
        by_service[action.split(":", 1)[0].lower()] += 1
    section("Brand-new actions by service", [
        f"{prefix}{f' ({service(prefix)})' if service(prefix) else ''}: {count}"
        for prefix, count in sorted(by_service.items(), key=lambda i: (-i[1], i[0]))[:TOP_NEW_ACTION_SERVICES]
    ])

    section("Removed policies", [f"{d['policyName']} ({day(d['date'])})" for d in summary["removed"]])

    return [
        "<!-- FACT SHEET for the author, not rendered. Pick the two or three stories that matter,",
        "     give each a short section with your opinion, then delete this comment.",
        f"     Full lists for readers: {SITE_URL}/changes/ (link it, do not copy it).",
        f"     Link a policy as {SITE_URL}/policies/<PolicyName>/.",
    ] + [comment_safe(f"     {line}") for line in notes] + ["-->"]


def render(summary, previous, label, service_names, as_of, post_date):
    months = summary["months"]
    span_text = range_text(months)
    if len(months) == 1:
        prev_label = month_bounds(previous["months"][0])[0].strftime("%B")
    else:
        prev_label = range_text(previous["months"], short=True)
    if label == span_text:
        scope = label
    else:
        year = month_bounds(months[-1])[0].strftime("%Y")
        if year in label and months[0][:4] == year:
            span_text = span_text.removesuffix(f" {year}")
        scope = f"{label} ({span_text})"
    service = lambda s: service_names.get(s.lower())  # noqa: E731

    n_new_actions = len(summary["new_actions"])
    n_prefixes = len(summary["new_prefixes"])
    description = (
        f"{scope} in AWS managed IAM policies: {summary['versions']:,} policy versions, "
        f"{len(summary['added']):,} new policies, {n_new_actions:,} new IAM actions and "
        f"{n_prefixes} new service prefixes, from the IAMTrail archive."
    )

    out = [
        "---",
        f'title: "AWS Managed Policy Changes: {label}"',
        f"date: {post_date.isoformat()}",
        "draft: true",
        "toc: false",
        f'description: "{description}"',
        "images: []",
        "tags:",
        "  - aws",
        "  - iam",
        "  - security",
        "---",
        "",
        f"<!-- Generated by IAMTrail automation/scripts/monthly_recap.py from the archive as of {as_of}.",
        f"     Target: around {TARGET_WORDS} words. A digest, not a data dump: the lists live on iamtrail.com.",
        "     Replace each TODO comment with your own words, add a social image to images, then set draft: false. -->",
    ]
    if summary["bulk_days"]:
        out.append(
            f"<!-- Excluded bulk-reformat days (over {BULK_DAY_THRESHOLD} policies): "
            f"{', '.join(summary['bulk_days'])}. -->"
        )
    out += [
        "",
        "<!-- TODO(zoph): opening hook, one or two lines. -->",
        "",
        f"**{summary['versions']:,}** new policy versions, **{len(summary['added']):,}** new policies and "
        f"**{n_new_actions:,}** IAM actions that never showed up in a managed policy before.",
        "",
        f"Here is the short version of **{scope}**, from the [IAMTrail]({SITE_URL}) archive. "
        f"The full lists (every policy, every diff) live on the [changes page]({SITE_URL}/changes/).",
        "",
        "## The Numbers",
        "",
        f"| | {label} | {prev_label} |",
        "| --- | --- | --- |",
    ]
    table = [
        ("Policy versions published", "versions"),
        ("New policies", lambda s: len(s["added"])),
        ("Actions added to existing policies", "actions_added"),
        ("IAM actions seen for the first time", lambda s: len(s["new_actions"])),
        ("New service prefixes", lambda s: len(s["new_prefixes"])),
    ]
    for title, key in table:
        get = key if callable(key) else (lambda s, k=key: s[k])
        out.append(f"| {title} | **{get(summary):,}** | {get(previous):,} |")

    if summary["new_prefixes"]:
        prefixes = [p for p, _, _ in summary["new_prefixes"]]
        out += [
            "",
            "## New Service Prefixes",
            "",
            f"A new IAM prefix usually lands before the SDK and the docs. "
            f"{'This one' if n_prefixes == 1 else f'These {n_prefixes}'}: {code_list(prefixes, MAX_PREFIXES)}.",
            "",
            "<!-- TODO(zoph): the theme in one or two lines. Prefix details:",
        ] + [
            comment_safe(f"     - {p}{f' ({service(p)})' if service(p) else ''}: first in {pol} on {day(d)}")
            for p, pol, d in summary["new_prefixes"]
        ] + ["-->"]

    out += [""] + fact_sheet(summary, label, service) + [
        "",
        "<!-- TODO(zoph): two or three short sections (## headline each), one story per section, with your opinion. -->",
        "",
        "## What to Check in Your Accounts",
        "",
        "<!-- TODO(zoph): one or two concrete checks, a command if it helps. -->",
        "",
        "## Takeaways",
        "",
        "<!-- TODO(zoph): three or four bullets. -->",
        "",
        f"Do not read diffs by hand: [subscribe on IAMTrail]({SITE_URL}/subscribe/) to the policies you "
        f"actually attach (instant or daily alerts, or [RSS]({SITE_URL}/feeds/)).",
        "",
        "Want someone to check how these changes land in your own AWS Organization? That is "
        "literally my job at [zoph.io](https://zoph.io) (Self-promotion).",
        "",
        "That's all, folks! 👋🏼",
        "",
        "zoph.",
        "",
    ]
    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    today = dt.datetime.now(dt.timezone.utc)
    last_month = (today.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    parser.add_argument("--month", default=last_month, help="YYYY-MM, default: last month")
    parser.add_argument("--to", help="YYYY-MM, last month of a longer period (default: --month)")
    parser.add_argument("--label", help='post name, like "Summer 2026" (default: the month or range)')
    parser.add_argument("--out-dir", type=Path, help="weblog content/posts; stdout if omitted")
    parser.add_argument("--force", action="store_true", help="overwrite an existing draft")
    args = parser.parse_args()

    try:
        month_start, _ = month_bounds(args.month)
        last_start, month_end = month_bounds(args.to or args.month)
    except ValueError:
        parser.error("--month and --to must be YYYY-MM")
    if last_start < month_start:
        parser.error("--to must not be before --month")
    if month_start > today:
        parser.error(f"{month_start:%Y-%m} has not started yet")
    months = month_range(month_start.strftime("%Y-%m"), last_start.strftime("%Y-%m"))
    label = args.label or range_text(months)
    if args.out_dir:
        args.out_dir = args.out_dir.resolve()

    os.chdir(REPO_ROOT)
    # The replay caps deltas for the feeds; a recap needs every change in the month.
    registry.MAX_DELTAS = None
    # build() reports progress on stdout, which is where the post goes without --out-dir.
    with contextlib.redirect_stdout(sys.stderr):
        _, deltas = registry.build()
    mark_repeated_versions(deltas)

    summary = summarize(deltas, months)
    previous = summarize(deltas, comparison_months(months))
    metadata = json.loads((REPO_ROOT / "data/iam-metadata.json").read_text())
    service_names = {k.lower(): v for k, v in metadata.get("serviceNames", {}).items()}

    post_date = month_end.astimezone(AUTHOR_TZ).replace(hour=7, minute=37, second=0, microsecond=0)
    as_of = today.strftime("%Y-%m-%dT%H:%MZ")
    if today < month_end:
        as_of += f" (to date: {range_text(months)} is not over)"
    text = render(summary, previous, label, service_names, as_of, post_date)
    words = visible_words(text)
    print(f"Generated {words} visible words, before your prose (target: about {TARGET_WORDS}).", file=sys.stderr)

    if not args.out_dir:
        sys.stdout.write(text)
        return 0
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    target = args.out_dir / f"{post_date:%Y-%m-%d}-aws-managed-policy-changes-{slug}.md"
    if target.exists() and not args.force:
        print(f"{target} exists; pass --force to overwrite it (and your edits).", file=sys.stderr)
        return 1
    target.write_text(text)
    print(f"Wrote {target}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
