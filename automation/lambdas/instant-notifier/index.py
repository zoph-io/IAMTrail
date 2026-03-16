import json
import os
import re
import traceback
import urllib.request
import boto3
import discord_notifier as discord

dynamodb = boto3.resource("dynamodb")
ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "eu-west-3"))

SUBSCRIPTIONS_TABLE = os.environ["SUBSCRIPTIONS_TABLE"]
SENDER_EMAIL = os.environ["SENDER_EMAIL"]
SITE_URL = os.environ["SITE_URL"]
GITHUB_REPO = os.environ["GITHUB_REPO"]

subs_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)


def fetch_diff(commit_sha):
    """Fetch truncated diff from GitHub API."""
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/commits/{commit_sha}"
        req = urllib.request.Request(url, headers={
            "Accept": "application/vnd.github.v3.diff",
            "User-Agent": "IAMTrail-Instant/1.0",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            diff_text = resp.read().decode("utf-8", errors="replace")

        lines = diff_text.split("\n")
        truncated = len(lines) > 30
        lines = lines[:30]
        return lines, truncated
    except Exception as e:
        print(f"Failed to fetch diff for {commit_sha}: {e}")
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


def build_email_html(subscriber, policy_names, commit_url, commit_sha):
    """Compose the instant notification email HTML."""
    manage_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}"
    unsubscribe_url = f"{SITE_URL}/manage?token={subscriber['manage_token']}&action=unsubscribe"

    diff_lines, truncated = [], False
    if commit_sha:
        diff_lines, truncated = fetch_diff(commit_sha)
    diff_html = format_diff_html(diff_lines, truncated, commit_url)

    policy_sections = []
    for policy_name in policy_names:
        policy_url = f"{SITE_URL}/policies/{policy_name}"
        section = f"""
        <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <a href="{policy_url}" style="color:#2563eb;font-weight:600;text-decoration:none;font-size:14px;">
                    {policy_name}
                </a>
                {f' &middot; <a href="{commit_url}" style="color:#64748b;font-size:12px;text-decoration:none;">view commit</a>' if commit_url else ''}
            </div>
        </div>
        """
        policy_sections.append(section)

    policies_html = "".join(policy_sections)
    change_count = len(policy_names)

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1e293b;">
        <div style="padding:24px 0;border-bottom:2px solid #f59e0b;">
            <h1 style="margin:0;font-size:24px;color:#1e293b;">
                IAMTrail Instant Alert
            </h1>
            <p style="margin:8px 0 0;color:#64748b;font-size:14px;">
                {change_count} {'policy' if change_count == 1 else 'policies'} just changed
            </p>
        </div>

        <div style="padding:24px 0;">
            {policies_html}
            {f'<div style="padding:0 0 24px;">{diff_html}</div>' if diff_html else ''}
        </div>

        <div style="border-top:1px solid #e2e8f0;padding:24px 0;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">
                You're receiving this instant alert because you subscribed to IAMTrail policy change notifications.
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


def get_instant_subscribers():
    """Scan for confirmed subscribers with instant frequency."""
    result = subs_table.scan(
        FilterExpression="confirmed = :c AND frequency = :f",
        ExpressionAttributeValues={":c": True, ":f": "instant"},
    )
    return result.get("Items", [])


def handler(event, context):
    print(f"Received {len(event.get('Records', []))} records")

    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            message_str = body.get("Message", body)
            if isinstance(message_str, str):
                message = json.loads(message_str)
            else:
                message = message_str

            updated_policies = message.get("UpdatedPolicies", "")
            commit_url = message.get("CommitUrl", "")

            commit_sha = ""
            sha_match = re.search(r"/commit/([a-f0-9]+)", commit_url)
            if sha_match:
                commit_sha = sha_match.group(1)

            policy_names = [p.strip() for p in updated_policies.split(",") if p.strip()]
            if not policy_names:
                print("No policy names found in message, skipping")
                continue

            print(f"Processing instant notifications for {len(policy_names)} policies")

            subscribers = get_instant_subscribers()
            if not subscribers:
                print("No instant subscribers found")
                continue

            sent_count = 0
            fail_count = 0
            for subscriber in subscribers:
                subscribed_policies = set(subscriber.get("policies", ["*"]))

                if "*" in subscribed_policies:
                    matching_policies = policy_names
                else:
                    matching_policies = [p for p in policy_names if p in subscribed_policies]

                if not matching_policies:
                    continue

                try:
                    html = build_email_html(subscriber, matching_policies, commit_url, commit_sha)
                    change_count = len(matching_policies)
                    ses.send_email(
                        Source=SENDER_EMAIL,
                        Destination={"ToAddresses": [subscriber["email"]]},
                        Message={
                            "Subject": {
                                "Data": f"IAMTrail Alert: {change_count} {'policy' if change_count == 1 else 'policies'} just changed"
                            },
                            "Body": {"Html": {"Data": html}},
                        },
                    )
                    sent_count += 1
                except Exception as e:
                    fail_count += 1
                    print(f"Failed to send to {subscriber['email']}: {e}")
                    discord.send(
                        "Instant Send Failure",
                        f"Failed to email {discord.mask_email(subscriber['email'])}",
                        discord.COLOR_WARNING,
                        fields=[("Error", str(e)[:200], False)],
                    )

            print(f"Sent {sent_count} instant notification emails")

            preview = ", ".join(policy_names[:5])
            if len(policy_names) > 5:
                preview += f" (+{len(policy_names) - 5} more)"

            fields = [
                ("Emails Sent", str(sent_count), True),
                ("Policies", str(len(policy_names)), True),
            ]
            if commit_url:
                fields.append(("Commit", f"[View]({commit_url})", True))
            if fail_count:
                fields.append(("Failures", str(fail_count), True))

            discord.send(
                "Instant Alerts Sent",
                preview,
                discord.COLOR_SUCCESS if not fail_count else discord.COLOR_WARNING,
                fields=fields,
            )

        except Exception as e:
            print(f"Error processing record: {e}")
            discord.send(
                "Instant Notifier Error",
                f"```{traceback.format_exc()[-1000:]}```",
                discord.COLOR_ERROR,
            )
            raise

    return {"statusCode": 200, "body": "OK"}
