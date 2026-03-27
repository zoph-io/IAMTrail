import json
import os
import time
import traceback
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
import boto3
from boto3.dynamodb.conditions import Key
import discord_notifier as discord

dynamodb = boto3.resource("dynamodb")
ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "eu-west-3"))

SUBSCRIPTIONS_TABLE = os.environ["SUBSCRIPTIONS_TABLE"]
CHANGES_TABLE = os.environ["CHANGES_TABLE"]
ENDPOINT_CHANGES_TABLE = os.environ.get("ENDPOINT_CHANGES_TABLE", "")
GUARDDUTY_TABLE = os.environ.get("GUARDDUTY_TABLE", "")
SENDER_EMAIL = os.environ["SENDER_EMAIL"]
SITE_URL = os.environ["SITE_URL"]
GITHUB_REPO = os.environ["GITHUB_REPO"]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

subs_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
changes_table = dynamodb.Table(CHANGES_TABLE)
endpoint_table = dynamodb.Table(ENDPOINT_CHANGES_TABLE) if ENDPOINT_CHANGES_TABLE else None
guardduty_table = dynamodb.Table(GUARDDUTY_TABLE) if GUARDDUTY_TABLE else None

_diff_cache = {}


def get_recent_policy_changes(days):
    """Query policy changes from the last N days."""
    changes = []
    now = datetime.now(timezone.utc)
    for i in range(days + 1):
        date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        result = changes_table.query(
            KeyConditionExpression=Key("date").eq(date_str),
        )
        changes.extend(result.get("Items", []))
    return changes


def get_recent_endpoint_changes(days):
    """Query endpoint changes from the last N days."""
    if not endpoint_table:
        return []
    changes = []
    now = datetime.now(timezone.utc)
    for i in range(days + 1):
        date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        result = endpoint_table.query(
            KeyConditionExpression=Key("detected_date").eq(date_str),
        )
        changes.extend(result.get("Items", []))
    return changes


def get_recent_guardduty_changes(days):
    """Query GuardDuty announcements from the last N days."""
    if not guardduty_table:
        return []
    changes = []
    now = datetime.now(timezone.utc)
    for i in range(days + 1):
        date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        result = guardduty_table.query(
            KeyConditionExpression=Key("announcement_date").eq(date_str),
        )
        changes.extend(result.get("Items", []))
    return changes


def fetch_diff(commit_sha, _max_retries=3):
    """Fetch truncated diff from GitHub API with caching and retry."""
    if commit_sha in _diff_cache:
        return _diff_cache[commit_sha]

    headers = {
        "Accept": "application/vnd.github.v3.diff",
        "User-Agent": "IAMTrail-Digest/1.0",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    url = f"https://api.github.com/repos/{GITHUB_REPO}/commits/{commit_sha}"

    for attempt in range(_max_retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                diff_text = resp.read().decode("utf-8", errors="replace")

            lines = diff_text.split("\n")
            truncated = len(lines) > 30
            result = (lines[:30], truncated)
            _diff_cache[commit_sha] = result
            return result
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and attempt < _max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"Rate limited fetching {commit_sha[:8]}, retrying in {wait}s (attempt {attempt + 1}/{_max_retries})")
                time.sleep(wait)
                continue
            print(f"Failed to fetch diff for {commit_sha[:8]}: {e}")
            break
        except Exception as e:
            print(f"Failed to fetch diff for {commit_sha[:8]}: {e}")
            break

    _diff_cache[commit_sha] = ([], False)
    return [], False


def format_diff_html(lines, truncated, commit_url):
    """Render diff lines as email-safe HTML."""
    if not lines:
        return ""

    html_lines = []
    for line in lines:
        if line.startswith("+") and not line.startswith("+++"):
            color = "#22863a"
        elif line.startswith("-") and not line.startswith("---"):
            color = "#cb2431"
        elif line.startswith("@@"):
            color = "#6f42c1"
        else:
            color = "#24292e"

        escaped = (
            line.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        html_lines.append(f'<span style="color:{color};">{escaped}</span>')

    joined = "\n".join(html_lines)
    suffix = ""
    if truncated:
        suffix = f'\n<a href="{commit_url}" style="color:#2563eb;font-size:12px;">View full diff on GitHub &rarr;</a>'

    return (
        f'<pre style="background:#f6f8fa;padding:12px;border-radius:6px;'
        f'font-size:12px;line-height:1.4;overflow-x:auto;font-family:monospace;">'
        f"{joined}{suffix}</pre>"
    )


def _build_policy_section(changes):
    """Build the IAM policy changes section HTML."""
    sections = []
    for change in changes:
        policy_name = change["policy_name"]
        commit_url = change.get("commit_url", "")
        commit_sha = change.get("commit_sha", "")
        policy_url = f"{SITE_URL}/policies/{policy_name}"

        diff_html = ""
        if commit_sha:
            lines, truncated = fetch_diff(commit_sha)
            diff_html = format_diff_html(lines, truncated, commit_url)

        section = f"""
        <div style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <a href="{policy_url}" style="color:#2563eb;font-weight:600;text-decoration:none;font-size:14px;">
                    {policy_name}
                </a>
                {f' &middot; <a href="{commit_url}" style="color:#64748b;font-size:12px;text-decoration:none;">view commit</a>' if commit_url else ''}
            </div>
            {f'<div style="padding:12px 16px;">{diff_html}</div>' if diff_html else ''}
        </div>
        """
        sections.append(section)

    count = len(changes)
    return f"""
    <div style="margin-bottom:32px;">
        <h2 style="margin:0 0 4px;font-size:16px;color:#1e293b;">
            IAM Policy Changes
        </h2>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
            {count} {'policy' if count == 1 else 'policies'} changed
        </p>
        {"".join(sections)}
        <p style="margin:8px 0 0;font-size:12px;">
            <a href="{SITE_URL}/policies" style="color:#2563eb;text-decoration:none;">Browse all policies &rarr;</a>
        </p>
    </div>
    """


def _build_endpoint_section(changes):
    """Build the endpoint changes section HTML."""
    items = []
    for change in changes:
        desc = change.get("description", change.get("identifier", ""))
        change_type = change.get("change_type", "").replace("_", " ").title()
        partition = change.get("partition", "")
        commit_url = change.get("botocore_commit_url", "")

        escaped_desc = (
            desc.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )

        item = f"""
        <div style="margin-bottom:8px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
            <div style="font-size:13px;color:#1e293b;font-weight:500;">{escaped_desc}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
                {f'<span style="background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">{change_type}</span>' if change_type else ''}
                {f' &middot; {partition}' if partition else ''}
                {f' &middot; <a href="{commit_url}" style="color:#64748b;text-decoration:none;">botocore commit</a>' if commit_url else ''}
            </div>
        </div>
        """
        items.append(item)

    count = len(changes)
    return f"""
    <div style="margin-bottom:32px;">
        <h2 style="margin:0 0 4px;font-size:16px;color:#1e293b;">
            AWS Endpoint Changes
        </h2>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
            {count} {'change' if count == 1 else 'changes'} detected
        </p>
        {"".join(items)}
        <p style="margin:8px 0 0;font-size:12px;">
            <a href="{SITE_URL}/endpoints" style="color:#2563eb;text-decoration:none;">View endpoint tracker &rarr;</a>
        </p>
    </div>
    """


def _build_guardduty_section(changes):
    """Build the GuardDuty announcements section HTML."""
    TYPE_COLORS = {
        "NEW_FINDINGS": ("#fef2f2", "#dc2626"),
        "UPDATED_FINDINGS": ("#fff7ed", "#ea580c"),
        "NEW_FEATURES": ("#ecfdf5", "#059669"),
        "NEW_REGION": ("#eff6ff", "#2563eb"),
        "GENERAL": ("#f4f4f5", "#52525b"),
    }

    items = []
    for change in changes:
        gd_type = change.get("type", "GENERAL")
        short_desc = change.get("short_description", "")
        full_desc = change.get("description", "")
        link = change.get("link", "")
        bg, fg = TYPE_COLORS.get(gd_type, TYPE_COLORS["GENERAL"])
        label = gd_type.replace("_", " ").title()

        display_desc = short_desc or full_desc[:200]
        escaped_desc = (
            display_desc.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        item = f"""
        <div style="margin-bottom:8px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
            <div style="font-size:13px;color:#1e293b;font-weight:500;">{escaped_desc}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
                <span style="background:{bg};color:{fg};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">{label}</span>
                {f' &middot; <a href="{link}" style="color:#64748b;text-decoration:none;">Details</a>' if link else ''}
            </div>
        </div>
        """
        items.append(item)

    count = len(changes)
    return f"""
    <div style="margin-bottom:32px;">
        <h2 style="margin:0 0 4px;font-size:16px;color:#1e293b;">
            GuardDuty Announcements
        </h2>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
            {count} {'announcement' if count == 1 else 'announcements'}
        </p>
        {"".join(items)}
        <p style="margin:8px 0 0;font-size:12px;">
            <a href="{SITE_URL}/guardduty" style="color:#2563eb;text-decoration:none;">View GuardDuty feed &rarr;</a>
        </p>
    </div>
    """


def build_email_html(subscriber, policy_changes, endpoint_changes, guardduty_changes):
    """Compose the multi-topic digest email HTML."""
    manage_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}"
    unsubscribe_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}&action=unsubscribe"

    sections = []
    total_changes = 0

    if policy_changes:
        sections.append(_build_policy_section(policy_changes))
        total_changes += len(policy_changes)

    if endpoint_changes:
        sections.append(_build_endpoint_section(endpoint_changes))
        total_changes += len(endpoint_changes)

    if guardduty_changes:
        sections.append(_build_guardduty_section(guardduty_changes))
        total_changes += len(guardduty_changes)

    body_html = "\n".join(sections)

    summary_parts = []
    if policy_changes:
        n = len(policy_changes)
        summary_parts.append(f"{n} {'policy' if n == 1 else 'policies'}")
    if endpoint_changes:
        n = len(endpoint_changes)
        summary_parts.append(f"{n} endpoint {'change' if n == 1 else 'changes'}")
    if guardduty_changes:
        n = len(guardduty_changes)
        summary_parts.append(f"{n} GuardDuty {'announcement' if n == 1 else 'announcements'}")
    summary = ", ".join(summary_parts)

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;">
        <div style="padding:24px 0;border-bottom:2px solid #2563eb;">
            <h1 style="margin:0;font-size:24px;color:#1e293b;">
                IAMTrail Digest
            </h1>
            <p style="margin:8px 0 0;color:#64748b;font-size:14px;">
                {summary}
            </p>
        </div>

        <div style="padding:24px 0;">
            {body_html}
        </div>

        <div style="border-top:1px solid #e2e8f0;padding:24px 0;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">
                You're receiving this because you subscribed to IAMTrail notifications.
            </p>
            <p style="margin:0;">
                <a href="{manage_url}" style="color:#2563eb;font-size:12px;">Manage subscription</a>
                &nbsp;&middot;&nbsp;
                <a href="{unsubscribe_url}" style="color:#94a3b8;font-size:12px;">Unsubscribe</a>
            </p>
            <p style="color:#cbd5e1;font-size:11px;margin:12px 0 0;">
                <a href="{SITE_URL}" style="color:#94a3b8;">IAMTrail</a> by <a href="https://zoph.io" style="color:#94a3b8;">zoph.io</a>
            </p>
        </div>
    </div>
    """


def build_subject(policy_changes, endpoint_changes, guardduty_changes):
    """Build a concise email subject reflecting all included topics."""
    parts = []
    if policy_changes:
        n = len(policy_changes)
        parts.append(f"{n} {'policy' if n == 1 else 'policies'}")
    if endpoint_changes:
        n = len(endpoint_changes)
        parts.append(f"{n} endpoint {'change' if n == 1 else 'changes'}")
    if guardduty_changes:
        n = len(guardduty_changes)
        parts.append(f"{n} GuardDuty {'update' if n == 1 else 'updates'}")
    return f"IAMTrail: {', '.join(parts)}"


def handler(event, context):
    try:
        _diff_cache.clear()
        now = datetime.now(timezone.utc)
        is_monday = now.weekday() == 0

        daily_policy = get_recent_policy_changes(1)
        weekly_policy = get_recent_policy_changes(7) if is_monday else []

        daily_endpoints = get_recent_endpoint_changes(1)
        weekly_endpoints = get_recent_endpoint_changes(7) if is_monday else []

        daily_guardduty = get_recent_guardduty_changes(1)
        weekly_guardduty = get_recent_guardduty_changes(7) if is_monday else []

        has_daily = daily_policy or daily_endpoints or daily_guardduty
        has_weekly = weekly_policy or weekly_endpoints or weekly_guardduty

        if not has_daily and not has_weekly:
            print("No changes to report across any topic")
            discord.send(
                "Digest - No Changes",
                "No changes to report today (policies, endpoints, GuardDuty)",
                discord.COLOR_INFO,
                fields=[("Day", now.strftime("%A %Y-%m-%d"), True)],
            )
            return {"statusCode": 200, "body": "No changes"}

        all_policy = daily_policy + weekly_policy
        unique_shas = {c["commit_sha"] for c in all_policy if c.get("commit_sha")}
        if unique_shas:
            print(f"Pre-fetching diffs for {len(unique_shas)} unique commits")
            for sha in unique_shas:
                fetch_diff(sha)

        subscribers = []
        scan_kwargs = {
            "FilterExpression": "confirmed = :c",
            "ExpressionAttributeValues": {":c": True},
        }
        while True:
            result = subs_table.scan(**scan_kwargs)
            subscribers.extend(result.get("Items", []))
            if "LastEvaluatedKey" not in result:
                break
            scan_kwargs["ExclusiveStartKey"] = result["LastEvaluatedKey"]

        sent_count = 0
        fail_count = 0
        for subscriber in subscribers:
            frequency = subscriber.get("frequency", "daily")
            topics = set(subscriber.get("topics", ["iam_policies"]))
            subscribed_policies = set(subscriber.get("policies", ["*"]))

            if frequency == "instant":
                # Instant subscribers still get digest for non-IAM topics
                if not (topics & {"endpoints", "guardduty"}):
                    continue
            elif frequency == "daily":
                pass
            elif frequency == "weekly" and is_monday:
                pass
            else:
                continue

            if frequency == "daily" or frequency == "instant":
                pc = daily_policy if "iam_policies" in topics else []
                ec = daily_endpoints if "endpoints" in topics else []
                gc = daily_guardduty if "guardduty" in topics else []
            elif frequency == "weekly":
                pc = weekly_policy if "iam_policies" in topics else []
                ec = weekly_endpoints if "endpoints" in topics else []
                gc = weekly_guardduty if "guardduty" in topics else []
            else:
                continue

            # Instant subscribers only get digest for non-IAM topics
            if frequency == "instant":
                pc = []

            # Filter IAM policies by subscription preference
            if pc and "*" not in subscribed_policies:
                pc = [c for c in pc if c["policy_name"] in subscribed_policies]

            if not pc and not ec and not gc:
                continue

            try:
                html = build_email_html(subscriber, pc, ec, gc)
                subject = build_subject(pc, ec, gc)
                ses.send_email(
                    Source=SENDER_EMAIL,
                    Destination={"ToAddresses": [subscriber["email"]]},
                    Message={
                        "Subject": {"Data": subject},
                        "Body": {"Html": {"Data": html}},
                    },
                )
                sent_count += 1
            except Exception as e:
                fail_count += 1
                print(f"Failed to send to {subscriber['email']}: {e}")
                discord.send(
                    "Digest Send Failure",
                    f"Failed to email {discord.mask_email(subscriber['email'])}",
                    discord.COLOR_WARNING,
                    fields=[("Error", str(e)[:200], False)],
                )

        print(f"Sent {sent_count} digest emails")

        fields = [
            ("Emails Sent", str(sent_count), True),
            ("Daily Policies", str(len(daily_policy)), True),
            ("Daily Endpoints", str(len(daily_endpoints)), True),
            ("Daily GuardDuty", str(len(daily_guardduty)), True),
        ]
        if is_monday:
            fields.append(("Weekly Policies", str(len(weekly_policy)), True))
            fields.append(("Weekly Endpoints", str(len(weekly_endpoints)), True))
            fields.append(("Weekly GuardDuty", str(len(weekly_guardduty)), True))
        if fail_count:
            fields.append(("Failures", str(fail_count), True))

        discord.send(
            "Digest Complete",
            f"Sent {sent_count} digest emails",
            discord.COLOR_SUCCESS if not fail_count else discord.COLOR_WARNING,
            fields=fields,
        )

        return {"statusCode": 200, "body": f"Sent {sent_count} emails"}

    except Exception as e:
        discord.send(
            "Digest Sender Error",
            f"```{traceback.format_exc()[-1000:]}```",
            discord.COLOR_ERROR,
        )
        raise
