#!/usr/bin/env python3
"""Generate rich GitHub release notes for IAMTrail policy tags.

Given two consecutive tags, this categorizes the changes into New / Updated /
Removed AWS managed IAM policies, computes version bumps and the IAM actions
added or removed per policy, and renders a markdown body plus a clean release
title. Non-policy repo changes (website, automation, data, findings) are folded
into a collapsed section so they don't drown out the archive's core signal.

Stdlib only, so it runs on a bare GitHub Actions runner with no pip install.
"""

import argparse
import json
import re
import subprocess
import sys

POLICY_PREFIX = "policies/"
BLUESKY_URL = "https://bsky.app/profile/iamtrail.bsky.social"
RSS_PATH = "/feeds/iam-policies.xml"
MAX_ACTIONS_SHOWN = 15
TAG_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-\d{2}-\d{2}-update-(\d+)-policies$")


def git(*args):
    """Run a git command and return stdout (stripped). Returns "" on failure."""
    try:
        out = subprocess.run(
            ["git", *args],
            check=True,
            capture_output=True,
            text=True,
        )
        return out.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def read_blob(ref, path):
    """Return the parsed JSON of a file at a given git ref, or None."""
    raw = git("show", f"{ref}:{path}")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def policy_name(path):
    return path[len(POLICY_PREFIX):]


def version_id(doc):
    if not isinstance(doc, dict):
        return "?"
    return doc.get("PolicyVersion", {}).get("VersionId", "?")


def _statements(doc):
    if not isinstance(doc, dict):
        return []
    stmts = doc.get("PolicyVersion", {}).get("Document", {}).get("Statement", [])
    if isinstance(stmts, dict):
        return [stmts]
    if isinstance(stmts, list):
        return stmts
    return []


def action_set(doc):
    """Flatten every statement into a set of human-readable action labels.

    Effect (Deny) and NotAction are encoded into the label so that they surface
    in the added/removed diff, since both are security-relevant.
    """
    actions = set()
    for stmt in _statements(doc):
        if not isinstance(stmt, dict):
            continue
        effect = stmt.get("Effect", "Allow")
        for key in ("Action", "NotAction"):
            if key not in stmt:
                continue
            vals = stmt[key]
            if isinstance(vals, str):
                vals = [vals]
            if not isinstance(vals, list):
                continue
            for val in vals:
                if not isinstance(val, str):
                    continue
                label = val if key == "Action" else f"NotAction {val}"
                if effect == "Deny":
                    label = f"Deny {label}"
                actions.add(label)
    return actions


def document_json(doc):
    if not isinstance(doc, dict):
        return ""
    return json.dumps(
        doc.get("PolicyVersion", {}).get("Document", {}),
        sort_keys=True,
    )


def format_actions(actions):
    """Render a sorted, capped list of actions as inline code."""
    ordered = sorted(actions)
    shown = ordered[:MAX_ACTIONS_SHOWN]
    rendered = ", ".join(f"`{a}`" for a in shown)
    extra = len(ordered) - len(shown)
    if extra > 0:
        rendered += f" (+{extra} more)"
    return rendered


def commit_sha_for(previous, current, path):
    """Last commit touching a path within the prev..cur range, else current."""
    sha = git("log", f"{previous}..{current}", "--format=%H", "-1", "--", path)
    return sha or current


def classify(previous, current):
    """Split the diff into categorized policy changes and other files."""
    raw = git("diff", "--name-status", previous, current)
    new, updated, removed, other = [], [], [], []

    for line in raw.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status = parts[0]
        # Renames/copies report the destination path last.
        path = parts[-1]

        if not path.startswith(POLICY_PREFIX):
            other.append((status[0], path))
            continue

        name = policy_name(path)
        sha = commit_sha_for(previous, current, path)
        code = status[0]

        if code == "A":
            doc = read_blob(current, path)
            new.append({"name": name, "version": version_id(doc), "sha": sha})
        elif code == "D":
            doc = read_blob(previous, path)
            removed.append({"name": name, "version": version_id(doc), "sha": sha})
        else:  # M, R, C, T -> treat as an update
            old_doc = read_blob(previous, path)
            new_doc = read_blob(current, path)
            old_actions = action_set(old_doc)
            new_actions = action_set(new_doc)
            added = new_actions - old_actions
            gone = old_actions - new_actions
            scope_changed = (
                not added
                and not gone
                and document_json(old_doc) != document_json(new_doc)
            )
            updated.append({
                "name": name,
                "old_version": version_id(old_doc),
                "new_version": version_id(new_doc),
                "added": added,
                "removed": gone,
                "scope_changed": scope_changed,
                "sha": sha,
            })

    new.sort(key=lambda p: p["name"])
    updated.sort(key=lambda p: p["name"])
    removed.sort(key=lambda p: p["name"])
    return new, updated, removed, other


def policy_link(site_url, name):
    return f"{site_url}/policies/{name}"


def commit_link(repo, sha):
    return f"https://github.com/{repo}/commit/{sha}"


def render(previous, current, repo, site_url, new, updated, removed, other):
    lines = []
    match = TAG_RE.match(current)
    date = match.group(1) if match else (git("log", "-1", "--format=%cs", current) or current)

    counts = []
    if new:
        counts.append(f"{len(new)} new")
    if updated:
        counts.append(f"{len(updated)} updated")
    if removed:
        counts.append(f"{len(removed)} removed")
    summary = " \u00b7 ".join(counts) if counts else "No policy changes"

    lines.append(f"## IAMTrail policy changes - {date}")
    lines.append("")
    lines.append(
        f"{summary}. Unofficial archive of AWS managed IAM policy changes - "
        f"browse at [iamtrail.com]({site_url})."
    )
    lines.append("")

    if updated:
        lines.append(f"### Updated policies ({len(updated)})")
        lines.append("")
        for p in updated:
            bump = (
                f"{p['old_version']} -> {p['new_version']}"
                if p["old_version"] != p["new_version"]
                else p["new_version"]
            )
            lines.append(
                f"- **{p['name']}** {bump} - "
                f"[view]({policy_link(site_url, p['name'])}) \u00b7 "
                f"[commit]({commit_link(repo, p['sha'])})"
            )
            if p["added"]:
                lines.append(
                    f"  - Added ({len(p['added'])}): {format_actions(p['added'])}"
                )
            if p["removed"]:
                lines.append(
                    f"  - Removed ({len(p['removed'])}): {format_actions(p['removed'])}"
                )
            if p["scope_changed"]:
                lines.append("  - Resource/Condition scope changed")
        lines.append("")

    if new:
        lines.append(f"### New policies ({len(new)})")
        lines.append("")
        for p in new:
            lines.append(
                f"- **{p['name']}** ({p['version']}) - "
                f"[view]({policy_link(site_url, p['name'])}) \u00b7 "
                f"[commit]({commit_link(repo, p['sha'])})"
            )
        lines.append("")

    if removed:
        lines.append(f"### Removed policies ({len(removed)})")
        lines.append("")
        for p in removed:
            lines.append(
                f"- **{p['name']}** (was {p['version']}) - "
                f"[commit]({commit_link(repo, p['sha'])})"
            )
        lines.append("")

    if other:
        status_word = {"A": "added", "M": "modified", "D": "removed", "R": "renamed", "C": "copied"}
        lines.append("<details>")
        lines.append(f"<summary>Other repo changes ({len(other)} files)</summary>")
        lines.append("")
        for code, path in sorted(other, key=lambda x: x[1]):
            lines.append(f"- `{status_word.get(code, code.lower())}` {path}")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        f"Get alerts: subscribe at [iamtrail.com]({site_url}) \u00b7 "
        f"follow on [Bluesky]({BLUESKY_URL}) \u00b7 "
        f"[RSS]({site_url}{RSS_PATH})."
    )
    lines.append("")

    total = len(new) + len(updated) + len(removed)
    if total == 0:
        title = f"IAMTrail - {date}"
    else:
        noun = "policy change" if total == 1 else "policy changes"
        title = f"IAMTrail - {total} {noun} ({date})"

    return "\n".join(lines), title


def main():
    parser = argparse.ArgumentParser(description="Build IAMTrail GitHub release notes.")
    parser.add_argument("--previous", required=True, help="Previous tag/ref.")
    parser.add_argument("--current", required=True, help="Current tag/ref.")
    parser.add_argument("--repo", required=True, help="owner/repo slug.")
    parser.add_argument("--site-url", default="https://iamtrail.com", help="Public site base URL.")
    parser.add_argument("--output", required=True, help="Path to write the markdown body.")
    parser.add_argument("--title-output", help="Optional path to write the release title.")
    args = parser.parse_args()

    site_url = args.site_url.rstrip("/")
    new, updated, removed, other = classify(args.previous, args.current)
    body, title = render(args.previous, args.current, args.repo, site_url, new, updated, removed, other)

    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(body)

    if args.title_output:
        with open(args.title_output, "w", encoding="utf-8") as fh:
            fh.write(title)

    # Emit the title on stdout so the workflow can capture it.
    print(title)
    return 0


if __name__ == "__main__":
    sys.exit(main())
