import json
import os
import time
import traceback
import boto3
import bluesky_publisher
import discord_notifier as discord
import x_poster  # noqa: F401  # TODO(X-API): re-enable x_poster.post(...) below

TABLE_NAME = os.environ.get("GUARDDUTY_TABLE", "")
X_SECRET_ARN = os.environ.get("X_API_SECRET_ARN", "")

TYPE_CONFIG = {
    "NEW_FINDINGS": {
        "detail_key": "findingDetails",
        "description_fn": lambda d: d.get("findingType", ""),
        "detail_fn": lambda d: d.get("findingDescription", d.get("description", "")),
        "link_fn": lambda d: d.get("link", ""),
        "discord_color": 0xE74C3C,
        "discord_title": "New GuardDuty Finding",
        "tweet_prefix": "New AWS GuardDuty Finding:",
    },
    "UPDATED_FINDINGS": {
        "detail_key": "findingDetails",
        "description_fn": lambda d: d.get("findingType", ""),
        "detail_fn": lambda d: d.get("description", ""),
        "link_fn": lambda d: d.get("link", ""),
        "discord_color": 0xF39C12,
        "discord_title": "Updated GuardDuty Finding",
        "tweet_prefix": "Updated AWS GuardDuty Finding:",
    },
    "NEW_FEATURES": {
        "detail_key": "featureDetails",
        "description_fn": lambda d: d.get("featureDescription", ""),
        "detail_fn": lambda d: d.get("featureDescription", ""),
        "link_fn": lambda d: d.get("featureLink", ""),
        "discord_color": 0x2ECC71,
        "discord_title": "New GuardDuty Feature",
        "tweet_prefix": "New Feature on AWS GuardDuty:",
    },
    "NEW_REGION": {
        "detail_key": "regionDetails",
        "description_fn": lambda d: d.get("description", ""),
        "detail_fn": lambda d: d.get("description", ""),
        "link_fn": lambda d: d.get("link", ""),
        "discord_color": 0x3498DB,
        "discord_title": "New GuardDuty Region",
        "tweet_prefix": "New AWS GuardDuty Region:",
    },
}

GENERAL_CONFIG = {
    "discord_color": 0x95A5A6,
    "discord_title": "GuardDuty Announcement",
    "tweet_prefix": "AWS GuardDuty Update:",
}


def handler(event, context):
    print(f"Received {len(event.get('Records', []))} records")

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(TABLE_NAME)

    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            message_str = body.get("Message", body)
            if isinstance(message_str, str):
                message = json.loads(message_str)
            else:
                message = message_str

            msg_type = message.get("type", "UNKNOWN")
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            today = time.strftime("%Y-%m-%d", time.gmtime())
            timestamp_id = time.strftime("%Y-%m-%d-%H-%M-%S", time.gmtime())

            print(f"Processing GuardDuty announcement: {msg_type}")

            if msg_type == "GENERAL":
                _process_general(message, table, today, timestamp_id, now)
            elif msg_type in TYPE_CONFIG:
                _process_typed(message, msg_type, table, today, timestamp_id, now)
            else:
                print(f"Unknown message type: {msg_type}")
                discord.send(
                    "Unknown GuardDuty Announcement Type",
                    f"```json\n{json.dumps(message, indent=2)[:1500]}\n```",
                    discord.COLOR_WARNING,
                )

        except Exception as e:
            print(f"Error processing record: {e}")
            discord.send(
                "GuardDuty Recorder Error",
                f"```{traceback.format_exc()[-1000:]}```",
                discord.COLOR_ERROR,
            )
            raise


def _process_typed(message, msg_type, table, today, timestamp_id, now):
    config = TYPE_CONFIG[msg_type]
    details = message.get(config["detail_key"], [])

    for i, detail in enumerate(details):
        short_desc = config["description_fn"](detail)[:150]
        full_desc = config["detail_fn"](detail)
        link = config["link_fn"](detail)
        announcement_id = f"{msg_type}-{timestamp_id}-{i}"

        table.put_item(
            Item={
                "announcement_date": today,
                "announcement_id": announcement_id,
                "type": msg_type,
                "description": full_desc,
                "short_description": short_desc,
                "link": link,
                "raw_message": json.dumps(message),
                "detected_at": now,
            }
        )

        fields = [
            ("Type", msg_type, True),
            ("Date", today, True),
        ]
        if link:
            fields.append(("Link", f"[Details]({link})", True))

        discord.send(
            config["discord_title"],
            short_desc or full_desc[:200],
            config["discord_color"],
            fields=fields,
            footer="GuardDuty Monitor",
        )

        page_url = link if link else "https://iamtrail.com/guardduty"
        discord.send_public(
            config["discord_title"],
            short_desc or full_desc[:200],
            config["discord_color"],
            fields=fields,
            footer="GuardDuty",
            url=page_url,
        )

        tweet_text = _build_tweet(config["tweet_prefix"], short_desc, link)
        # TODO(X-API): x_poster.post(tweet_text, X_SECRET_ARN)
        bluesky_publisher.post(f"[GuardDuty] {tweet_text}")

    print(f"Recorded {len(details)} {msg_type} announcements")


def _process_general(message, table, today, timestamp_id, now):
    entries = message.get("message", [])

    for i, entry in enumerate(entries):
        title = entry.get("title", "")
        body = entry.get("body", "")
        links = entry.get("links", [])
        link = links[0] if links else ""
        announcement_id = f"GENERAL-{timestamp_id}-{i}"

        table.put_item(
            Item={
                "announcement_date": today,
                "announcement_id": announcement_id,
                "type": "GENERAL",
                "description": body,
                "short_description": title[:150],
                "link": link,
                "raw_message": json.dumps(message),
                "detected_at": now,
            }
        )

        fields = [
            ("Type", "GENERAL", True),
            ("Date", today, True),
        ]
        if link:
            fields.append(("Link", f"[Details]({link})", True))

        discord.send(
            GENERAL_CONFIG["discord_title"],
            f"**{title}**\n{body[:300]}",
            GENERAL_CONFIG["discord_color"],
            fields=fields,
            footer="GuardDuty Monitor",
        )

        page_url = link if link else "https://iamtrail.com/guardduty"
        discord.send_public(
            GENERAL_CONFIG["discord_title"],
            f"**{title}**\n{body[:300]}",
            GENERAL_CONFIG["discord_color"],
            fields=fields,
            footer="GuardDuty",
            url=page_url,
        )

        tweet_text = _build_tweet(GENERAL_CONFIG["tweet_prefix"], title, link)
        # TODO(X-API): x_poster.post(tweet_text, X_SECRET_ARN)
        bluesky_publisher.post(f"[GuardDuty] {tweet_text}")

    print(f"Recorded {len(entries)} GENERAL announcements")


def _build_tweet(prefix, description, link):
    max_desc_len = 280 - len(prefix) - 2
    if link:
        max_desc_len -= 24
    desc = description[:max_desc_len]
    if len(description) > max_desc_len:
        desc = desc[:max_desc_len - 3] + "..."
    parts = [prefix, desc]
    if link:
        parts.append(link)
    return " ".join(parts)
