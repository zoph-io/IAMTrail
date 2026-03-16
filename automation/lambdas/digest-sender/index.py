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
SENDER_EMAIL = os.environ["SENDER_EMAIL"]
SITE_URL = os.environ["SITE_URL"]
GITHUB_REPO = os.environ["GITHUB_REPO"]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

subs_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)
changes_table = dynamodb.Table(CHANGES_TABLE)

_diff_cache = {}


def get_recent_changes(days):
    """Query policy changes from the last N days."""
    changes = []
    now = datetime.now(timezone.utc)
    for i in range(days):
        date_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        result = changes_table.query(
            KeyConditionExpression=Key("date").eq(date_str),
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
        suffix = f'\n<a href="{commit_url}" style="color:#2563eb;font-size:12px;">View full diff on GitHub →</a>'

    return (
        f'<pre style="background:#f6f8fa;padding:12px;border-radius:6px;'
        f'font-size:12px;line-height:1.4;overflow-x:auto;font-family:monospace;">'
        f"{joined}{suffix}</pre>"
    )


def build_email_html(subscriber, changes):
    """Compose the digest email HTML."""
    manage_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}"
    unsubscribe_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}&action=unsubscribe"

    policy_sections = []
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
        <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <a href="{policy_url}" style="color:#2563eb;font-weight:600;text-decoration:none;font-size:14px;">
                    {policy_name}
                </a>
                {f' &middot; <a href="{commit_url}" style="color:#64748b;font-size:12px;text-decoration:none;">view commit</a>' if commit_url else ''}
            </div>
            {f'<div style="padding:12px 16px;">{diff_html}</div>' if diff_html else ''}
        </div>
        """
        policy_sections.append(section)

    policies_html = "".join(policy_sections)
    change_count = len(changes)

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;">
        <div style="padding:24px 0;border-bottom:2px solid #2563eb;">
            <h1 style="margin:0;font-size:24px;color:#1e293b;">
                IAMTrail Policy Update
            </h1>
            <p style="margin:8px 0 0;color:#64748b;font-size:14px;">
                {change_count} {'policy' if change_count == 1 else 'policies'} changed
            </p>
        </div>

        <div style="padding:24px 0;">
            {policies_html}
        </div>

        <div style="border-top:1px solid #e2e8f0;padding:24px 0;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">
                You're receiving this because you subscribed to IAMTrail policy change notifications.
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


def handler(event, context):
    try:
        _diff_cache.clear()
        now = datetime.now(timezone.utc)
        is_monday = now.weekday() == 0

        daily_changes = get_recent_changes(1)
        weekly_changes = get_recent_changes(7) if is_monday else []

        if not daily_changes and not weekly_changes:
            print("No policy changes to report")
            discord.send(
                "Digest - No Changes",
                "No policy changes to report today",
                discord.COLOR_INFO,
                fields=[("Day", now.strftime("%A %Y-%m-%d"), True)],
            )
            return {"statusCode": 200, "body": "No changes"}

        all_changes = daily_changes + weekly_changes
        unique_shas = {c["commit_sha"] for c in all_changes if c.get("commit_sha")}
        print(f"Pre-fetching diffs for {len(unique_shas)} unique commits")
        for sha in unique_shas:
            fetch_diff(sha)

        result = subs_table.scan(
            FilterExpression="confirmed = :c",
            ExpressionAttributeValues={":c": True},
        )
        subscribers = result.get("Items", [])

        sent_count = 0
        fail_count = 0
        for subscriber in subscribers:
            frequency = subscriber.get("frequency", "daily")
            subscribed_policies = set(subscriber.get("policies", ["*"]))

            if frequency == "instant":
                continue
            elif frequency == "daily":
                changes = daily_changes
            elif frequency == "weekly" and is_monday:
                changes = weekly_changes
            else:
                continue

            if not changes:
                continue

            if "*" not in subscribed_policies:
                changes = [
                    c for c in changes if c["policy_name"] in subscribed_policies
                ]

            if not changes:
                continue

            try:
                html = build_email_html(subscriber, changes)
                change_count = len(changes)
                ses.send_email(
                    Source=SENDER_EMAIL,
                    Destination={"ToAddresses": [subscriber["email"]]},
                    Message={
                        "Subject": {
                            "Data": f"IAMTrail: {change_count} {'policy' if change_count == 1 else 'policies'} changed"
                        },
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
            ("Daily Changes", str(len(daily_changes)), True),
        ]
        if is_monday:
            fields.append(("Weekly Changes", str(len(weekly_changes)), True))
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
