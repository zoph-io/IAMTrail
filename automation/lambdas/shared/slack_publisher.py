"""Deliver a subscriber's IAMTrail notifications to their Slack channel.

A subscriber attaches a Slack incoming webhook from the manage page, which only a
confirmed email address can reach. That is what stops anyone from pointing
IAMTrail at a workspace that is not theirs, and it is why the subscribe form
itself takes no webhook. The same digest and instant alerts they get by email are
posted to the channel, where a whole team sees them instead of one inbox.

Only hooks.slack.com URLs are accepted, so the Lambda can never be turned into a
request forwarder for arbitrary hosts.

A webhook Slack reports as permanently gone (app removed, channel archived or
deleted) is disconnected, and both the subscriber and the ops channel are told.
Leaving it attached would mean a channel that goes quiet forever while every run
fails, and nobody could tell that apart from a quiet week.

Never raises from post(): a broken channel must not fail a notification run.
"""

import json
import re
import time
import urllib.error
import urllib.request

WEBHOOK_RE = re.compile(
    r"^https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+$"
)

# Slack's answers for a webhook that will never work again.
PERMANENT_ERRORS = frozenset(
    {
        "invalid_webhook",
        "invalid_token",
        "no_service",
        "no_service_id",
        "no_team",
        "team_disabled",
        "no_active_hooks",
        "channel_not_found",
        "channel_is_archived",
        "action_prohibited",
        "posting_to_general_channel_denied",
    }
)

# Slack truncates a message's text beyond 40,000 characters.
MESSAGE_LIMIT = 40000

# One line per policy, then a link to the rest, so a bulk day stays readable.
MAX_POLICY_LINES = 15
MAX_TOPIC_LINES = 5

TIMEOUT_S = 10


def is_valid_webhook(url):
    return isinstance(url, str) and bool(WEBHOOK_RE.match(url.strip()))


def mask(url):
    """"hooks.slack.com/services/T0/B0/...abcd", enough to recognise, useless to reuse."""
    parts = str(url).rstrip("/").split("/")
    if len(parts) < 3:
        return "hooks.slack.com/..."
    return f"hooks.slack.com/services/{parts[-3]}/{parts[-2]}/...{parts[-1][-4:]}"


def escape(text):
    """Slack mrkdwn treats these three as control characters."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def link(url, label):
    return f"<{url}|{escape(label)}>"


def post(url, text):
    """Post one message. Returns (ok, error), error being Slack's reason string."""
    if not is_valid_webhook(url):
        return False, "invalid_webhook"
    payload = {
        "text": text[:MESSAGE_LIMIT],
        "unfurl_links": False,
        "unfurl_media": False,
    }
    req = urllib.request.Request(
        url.strip(),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            body = resp.read().decode("utf-8", "replace").strip()
            if body == "ok":
                return True, ""
            return False, body[:100] or f"http_{resp.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace").strip()[:100]
        return False, body or f"http_{e.code}"
    except Exception as e:
        return False, f"transport error: {e}"[:100]


def is_permanent(error):
    return error in PERMANENT_ERRORS


def _alert(title, description, fields):
    try:
        import discord_notifier

        discord_notifier.send(
            title, description, discord_notifier.COLOR_ERROR, fields=fields
        )
    except Exception as e:
        print(f"[slack_publisher] Could not raise the alert: {e}")


def _disconnect(subscriber, url, error, table, ses, sender, site_url):
    """Detach a dead webhook, and tell the subscriber their channel went dark."""
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        # Conditional, so a webhook the subscriber replaced mid-run survives.
        table.update_item(
            Key={"email": subscriber["email"]},
            UpdateExpression="REMOVE slack_webhook SET slack_error = :e, slack_error_at = :t",
            ConditionExpression="slack_webhook = :u",
            ExpressionAttributeValues={":e": error, ":t": now, ":u": url},
        )
    except Exception as e:
        print(f"[slack_publisher] Could not disconnect the webhook: {e}")
        return

    try:
        import policy_diff

        manage_url = f"{site_url}/manage?token={subscriber['manage_token']}"
        ses.send_email(
            Source=sender,
            Destination={"ToAddresses": [subscriber["email"]]},
            Message={
                "Subject": {"Data": "IAMTrail: your Slack channel was disconnected"},
                "Body": {
                    "Html": {
                        "Data": policy_diff.render_email(
                            title="Slack channel disconnected",
                            summary=f"Slack answered {error}",
                            accent="#dc2626",
                            body_html=(
                                '<p style="font-size:14px;color:#475569;">'
                                "IAMTrail could not post to your Slack channel, and Slack "
                                "reports the webhook will not work again, usually because "
                                "the app was removed or the channel archived. Email "
                                "notifications continue as before.</p>"
                                f'<p style="font-size:14px;"><a href="{manage_url}" '
                                'style="color:#2563eb;">Connect a new webhook</a></p>'
                            ),
                            site_url=site_url,
                            manage_token=subscriber["manage_token"],
                            intro="You're receiving this because you connected a Slack channel to IAMTrail.",
                        )
                    }
                },
            },
        )
    except Exception as e:
        print(f"[slack_publisher] Could not email the disconnect notice: {e}")


def deliver(subscriber, render, table, ses, sender, site_url):
    """Post render() to the subscriber's channel when one is connected.

    render is only called when there is a channel, and a failure inside it is
    contained here, so a rendering bug cannot stop the loop over subscribers.
    Returns True when posted, False when it failed, None when no channel is set.
    """
    url = subscriber.get("slack_webhook")
    if not url:
        return None

    try:
        import discord_notifier

        who = discord_notifier.mask_email(subscriber["email"])
    except Exception:
        who = "a subscriber"

    try:
        text = render()
    except Exception as e:
        _alert(
            "Slack message could not be rendered",
            f"Nothing was posted to the Slack channel of {who}.",
            [("Error", str(e)[:200], False)],
        )
        return False

    ok, error = post(url, text)
    if ok:
        return True

    if is_permanent(error):
        _disconnect(subscriber, url, error, table, ses, sender, site_url)
        _alert(
            "Slack channel disconnected",
            f"Slack reports the webhook for {who} is gone, so it was detached "
            "and the subscriber was emailed.",
            [("Error", error, True), ("Webhook", mask(url), True)],
        )
    else:
        _alert(
            "Slack delivery failed",
            f"Could not post to the Slack channel of {who}, so the channel missed "
            "this notification. The webhook stays attached for the next run.",
            [("Error", error, True), ("Webhook", mask(url), True)],
        )
    return False


# ──────────────────────────────
# Rendering
# ──────────────────────────────


def _policy_line(change, site_url):
    import iam_metadata
    import policy_diff
    from urllib.parse import quote

    name = change["name"]
    url = f"{site_url}/policies/{quote(name, safe='')}"
    status = policy_diff.STATUS_WORDS.get(change.get("status"), "updated")
    version = change.get("new_version") or change.get("old_version") or ""
    head = f"{link(url, name)} ({escape(status)}{', ' + escape(version) if version else ''})"

    parts = []
    prefixes = change.get("new_service_prefixes") or []
    new_actions = change.get("new_actions") or []
    if prefixes:
        parts.append(f"*{escape(policy_diff.sentence(policy_diff.new_service_phrase(prefixes)))}*")
    elif new_actions:
        parts.append(f"*{escape(policy_diff.sentence(policy_diff.never_before_seen(len(new_actions))))}*")

    added = change.get("actions_added") or []
    removed = change.get("actions_removed") or []
    if change.get("detailed", True):
        unknown = not change.get("resolved")
        parts.append(escape(policy_diff.action_delta_phrase(added, removed, unknown=unknown)))

    escalations = iam_metadata.permissions_management(added)
    if escalations:
        parts.append(escape(policy_diff.permissions_management_phrase(escalations)))

    return f"• {head}" + (f": {'; '.join(parts)}" if parts else "")


def render_policy_lines(changes, site_url):
    """One mrkdwn line per policy change, discoveries first."""
    import policy_diff

    ordered = sorted(changes, key=policy_diff.discovery_rank)
    lines = [_policy_line(c, site_url) for c in ordered[:MAX_POLICY_LINES]]
    left = len(ordered) - MAX_POLICY_LINES
    if left > 0:
        lines.append(f"• and {left} more on {link(f'{site_url}/changes', 'iamtrail.com/changes')}")
    return lines


def render_topic_lines(items, describe):
    """Up to MAX_TOPIC_LINES entries of an endpoint or GuardDuty list."""
    lines = [f"• {escape(describe(i))}" for i in items[:MAX_TOPIC_LINES]]
    left = len(items) - MAX_TOPIC_LINES
    if left > 0:
        lines.append(f"• and {left} more")
    return lines


def render_message(title, summary, sections, site_url):
    """The shared layout: a bold title line, one block per topic, a site link.

    No manage link, unlike the email: a channel is read by a whole team, and the
    manage token would let any of them change or cancel the subscription.
    """
    out = [f"*{escape(title)}*: {escape(summary)}"]
    for heading, lines in sections:
        if lines:
            out.append("")
            out.append(f"*{escape(heading)}*")
            out.extend(lines)
    out.append("")
    out.append(f"Sent by {link(site_url, 'IAMTrail')}, the unofficial AWS managed policy archive")
    return "\n".join(out)
