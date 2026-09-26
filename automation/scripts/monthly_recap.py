#!/usr/bin/env python3
"""Draft the monthly "AWS managed policy changes" post for zoph.me.

Replays the archive with build_action_registry.build(), keeps the deltas that
fall in one calendar month (UTC), and renders a Hugo post with every number,
list and link already filled in. The parts that need an opinion (the hook, why
a change matters, what to check) are left as HTML comments for the author:
Hugo drops raw HTML, so a TODO that survives into production renders nothing.

The post is always written with draft: true. Run it after the month closes;
running it mid-month works but covers the month to date only.

    python3 automation/scripts/monthly_recap.py --month 2026-09 \
        --out-dir ../weblog/content/posts

or `make monthly-recap MONTH=2026-09 OUT=../weblog/content/posts`.

Stdlib only, like build_action_registry.py.
"""

import argparse
import base64
import calendar
import contextlib
import datetime as dt
import json
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
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

TOP_UPDATES = 10
MAX_NEW_POLICIES = 15
MAX_LISTED_ACTIONS = 5
TOP_NEW_ACTION_SERVICES = 8
MIN_VERSIONS_MOST_ACTIVE = 3


def policy_url(name):
    return f"{SITE_URL}/policies/{quote(name, safe='')}/"


def action_url(action):
    """Mirror iamActionToSlug in website/lib/actionSlug.ts."""
    slug = base64.urlsafe_b64encode(action.encode()).decode().rstrip("=")
    return f"{SITE_URL}/actions/{slug}/"


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


def current_literal_actions():
    """Exact action spellings in today's policies: the ones with an action page."""
    actions = set()
    for path in (REPO_ROOT / "policies").iterdir():
        try:
            actions |= registry.literal_actions(json.loads(path.read_text()))
        except (json.JSONDecodeError, UnicodeDecodeError, IsADirectoryError):
            continue
    return actions


def month_bounds(month):
    start = dt.datetime.strptime(month, "%Y-%m").replace(tzinfo=dt.timezone.utc)
    end = (start + dt.timedelta(days=32)).replace(day=1)
    return start, end


def previous_month(month):
    start, _ = month_bounds(month)
    return (start - dt.timedelta(days=1)).strftime("%Y-%m")


def in_month(deltas, month):
    """Deltas dated in month, oldest first, with bulk-reformat days split out."""
    rows = sorted((d for d in deltas if d["date"].startswith(month)), key=lambda d: d["date"])
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


def summarize(deltas, month):
    rows, bulk_days = in_month(deltas, month)
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
        "month": month,
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


def code_list(items, limit=MAX_LISTED_ACTIONS, link=None):
    shown = [f"[`{a}`]({link(a)})" if link and link(a) else f"`{a}`" for a in items[:limit]]
    text = ", ".join(shown)
    if len(items) > limit:
        text += f" and {len(items) - limit:,} more"
    return text


def day(date):
    return dt.datetime.strptime(date[:10], "%Y-%m-%d").strftime("%b %-d")


def render(summary, previous, service_names, linkable, as_of, post_date):
    month_start, _ = month_bounds(summary["month"])
    label = month_start.strftime("%B %Y")
    prev_label = month_bounds(previous["month"])[0].strftime("%B")
    link_action = lambda a: action_url(a) if a in linkable else None  # noqa: E731
    service = lambda s: service_names.get(s.lower())  # noqa: E731

    n_new_actions = len(summary["new_actions"])
    n_prefixes = len(summary["new_prefixes"])
    description = (
        f"{label} in AWS managed IAM policies: {summary['versions']} policy versions, "
        f"{len(summary['added'])} new policies, {n_new_actions} new IAM actions and "
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
        "  - AWS",
        "  - IAM",
        "  - Security",
        "  - IAMTrail",
        "---",
        "",
        f"<!-- Generated by IAMTrail automation/scripts/monthly_recap.py from the archive as of {as_of}.",
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
        f"Here is what changed in AWS managed IAM policies in **{label}**, straight from the "
        f"[IAMTrail]({SITE_URL}) archive.",
        "",
        "## The Numbers",
        "",
        f"| | {label} | {prev_label} |",
        "| --- | --- | --- |",
    ]
    table = [
        ("Policy versions published", "versions"),
        ("Distinct policies updated", lambda s: len(s["modified"])),
        ("New policies", lambda s: len(s["added"])),
        ("Policies removed", lambda s: len(s["removed"])),
        ("Actions added to existing policies", "actions_added"),
        ("Actions removed from existing policies", "actions_removed"),
        ("IAM actions seen for the first time", lambda s: len(s["new_actions"])),
        ("New service prefixes", lambda s: len(s["new_prefixes"])),
    ]
    for title, key in table:
        get = key if callable(key) else (lambda s, k=key: s[k])
        out.append(f"| {title} | **{get(summary):,}** | {get(previous):,} |")

    if summary["new_prefixes"]:
        out += [
            "",
            "## New Service Prefixes",
            "",
            "The strongest signal in the archive: the IAM prefix usually lands before the SDK and the docs.",
            "",
        ]
        for prefix, policy, date in summary["new_prefixes"]:
            name = service(prefix)
            count = sum(1 for a, _ in summary["new_actions"].values()
                        if a.split(":", 1)[0].lower() == prefix.lower())
            out.append(
                f"- `{prefix}`{f' ({name})' if name else ''}: first seen in "
                f"[{policy}]({policy_url(policy)}) on {day(date)}, with {count} action"
                f"{'' if count == 1 else 's'}."
            )
        out += ["", "<!-- TODO(zoph): what are these services? -->"]

    wildcards = wildcard_changes(summary)
    if wildcards:
        out += ["", "## New Wildcard Grants", ""]
        for name, gained, is_new in wildcards:
            where = "new policy" if is_new else "updated"
            out.append(f"- [{name}]({policy_url(name)}) ({where}): {code_list(gained)}")
        out += ["", "<!-- TODO(zoph): which of these deserve a second look? -->"]

    if summary["added"]:
        out += ["", "## New Policies", ""]
        for d in summary["added"][:MAX_NEW_POLICIES]:
            prefixes = sorted({a.split(":", 1)[0] for a in d["actionsAdded"]})
            count = len(d["actionsAdded"])
            services = f" across {code_list(prefixes, 4)}" if prefixes else ""
            out.append(
                f"- [{d['policyName']}]({policy_url(d['policyName'])}), {day(d['date'])}: "
                f"{count} action{'' if count == 1 else 's'}{services}."
            )
        if len(summary["added"]) > MAX_NEW_POLICIES:
            out.append(
                f"- And {len(summary['added']) - MAX_NEW_POLICIES} more on the "
                f"[changes page]({SITE_URL}/changes/)."
            )

    ranked = sorted(
        summary["modified"].items(),
        key=lambda item: (-(len(item[1]["added"]) + len(item[1]["removed"])), item[0].lower()),
    )
    ranked = [item for item in ranked if item[1]["added"] or item[1]["removed"]][:TOP_UPDATES]
    if ranked:
        out += ["", "## Biggest Updates", ""]
        for name, p in ranked:
            seq = p["sequence"]
            if not seq:
                span = ""
            elif len(seq) == 1:
                span = f" (`{seq[0]}`)"
            elif seq[-1] in seq[:-1]:
                span = f" (`{seq[0]}` to `{seq[-2]}`, then rolled back to `{seq[-1]}`)"
            else:
                span = f" (`{seq[0]}` to `{seq[-1]}`)"
            line = (
                f"- **[{name}]({policy_url(name)})**{span}: "
                f"**+{len(p['added']):,}** / **-{len(p['removed']):,}**."
            )
            if p["added"]:
                line += f" Added {code_list(sorted(p['added'].values()))}."
            if p["removed"]:
                line += f" Removed {code_list(sorted(p['removed'].values()))}."
            out.append(line)
        out += ["", "<!-- TODO(zoph): pick the two or three that matter and say why. -->"]

    if summary["new_actions"]:
        by_service = defaultdict(list)
        for action, _ in summary["new_actions"].values():
            by_service[action.split(":", 1)[0].lower()].append(action)
        top = sorted(by_service.items(), key=lambda item: (-len(item[1]), item[0]))
        out += [
            "",
            "## Brand-New IAM Actions",
            "",
            f"**{n_new_actions}** actions appeared in a managed policy for the first time. "
            "Where they came from:",
            "",
        ]
        for prefix, actions in top[:TOP_NEW_ACTION_SERVICES]:
            name = service(prefix)
            out.append(
                f"- `{prefix}`{f' ({name})' if name else ''}: **{len(actions)}**, like "
                f"{code_list(sorted(actions), 3, link=link_action)}"
            )
        if len(top) > TOP_NEW_ACTION_SERVICES:
            rest = sum(len(a) for _, a in top[TOP_NEW_ACTION_SERVICES:])
            out.append(f"- {rest} more across {len(top) - TOP_NEW_ACTION_SERVICES} other services.")

    busy = sorted(
        ((name, len(p["versions"])) for name, p in summary["modified"].items()
         if len(p["versions"]) >= MIN_VERSIONS_MOST_ACTIVE),
        key=lambda item: (-item[1], item[0].lower()),
    )
    if busy:
        out += ["", "## Most Active", ""]
        for name, count in busy[:10]:
            out.append(f"- [{name}]({policy_url(name)}): {count} versions in one month.")

    if summary["removed"]:
        out += ["", "## Removed", ""]
        for d in summary["removed"]:
            out.append(f"- `{d['policyName']}`, {day(d['date'])}.")

    out += [
        "",
        "## What to Check in Your Accounts",
        "",
        "<!-- TODO(zoph): two or three concrete checks for this month. -->",
        "",
        "## Takeaways",
        "",
        "<!-- TODO(zoph): the short list. -->",
        "",
        f"IAMTrail sends [instant or daily alerts]({SITE_URL}/subscribe/) when a policy you care "
        f"about changes, and every change is also on the [RSS feeds]({SITE_URL}/feeds/).",
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
    parser.add_argument("--out-dir", type=Path, help="weblog content/posts; stdout if omitted")
    parser.add_argument("--force", action="store_true", help="overwrite an existing draft")
    args = parser.parse_args()

    try:
        month_start, month_end = month_bounds(args.month)
    except ValueError:
        parser.error("--month must be YYYY-MM")
    args.month = month_start.strftime("%Y-%m")
    if month_start > today:
        parser.error(f"{args.month} has not started yet")
    if args.out_dir:
        args.out_dir = args.out_dir.resolve()

    os.chdir(REPO_ROOT)
    # The replay caps deltas for the feeds; a recap needs every change in the month.
    registry.MAX_DELTAS = None
    # build() reports progress on stdout, which is where the post goes without --out-dir.
    with contextlib.redirect_stdout(sys.stderr):
        _, deltas = registry.build()
    mark_repeated_versions(deltas)

    summary = summarize(deltas, args.month)
    previous = summarize(deltas, previous_month(args.month))
    metadata = json.loads((REPO_ROOT / "data/iam-metadata.json").read_text())
    service_names = {k.lower(): v for k, v in metadata.get("serviceNames", {}).items()}

    post_date = month_end.astimezone(AUTHOR_TZ).replace(hour=7, minute=37, second=0, microsecond=0)
    as_of = today.strftime("%Y-%m-%dT%H:%MZ")
    if today < month_end:
        as_of += f" (month to date: {args.month} is not over)"
    text = render(summary, previous, service_names, current_literal_actions(), as_of, post_date)

    if not args.out_dir:
        sys.stdout.write(text)
        return 0
    month_name = calendar.month_name[int(args.month[5:])].lower()
    target = args.out_dir / (
        f"{post_date:%Y-%m-%d}-aws-managed-policy-changes-{month_name}-{args.month[:4]}.md"
    )
    if target.exists() and not args.force:
        print(f"{target} exists; pass --force to overwrite it (and your edits).", file=sys.stderr)
        return 1
    target.write_text(text)
    print(f"Wrote {target}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
