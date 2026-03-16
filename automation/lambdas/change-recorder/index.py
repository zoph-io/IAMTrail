import json
import os
import time
import re
import traceback
import boto3
import discord_notifier as discord

TABLE_NAME = os.environ.get("CHANGES_TABLE", "")
TTL_DAYS = 30


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

            updated_policies = message.get("UpdatedPolicies", "")
            commit_url = message.get("CommitUrl", "")

            commit_sha = ""
            sha_match = re.search(r"/commit/([a-f0-9]+)", commit_url)
            if sha_match:
                commit_sha = sha_match.group(1)

            today = time.strftime("%Y-%m-%d", time.gmtime())
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            ttl = int(time.time()) + (TTL_DAYS * 86400)

            policy_names = [p.strip() for p in updated_policies.split(",") if p.strip()]
            print(f"Processing {len(policy_names)} policies for {today}")

            with table.batch_writer() as batch:
                for i, policy_name in enumerate(policy_names):
                    batch.put_item(
                        Item={
                            "date": today,
                            "policy_name": policy_name,
                            "commit_url": commit_url,
                            "commit_sha": commit_sha,
                            "detected_at": now,
                            "ttl": ttl,
                        }
                    )
                    if (i + 1) % 100 == 0:
                        print(f"  Written {i + 1}/{len(policy_names)}")

            print(f"Recorded {len(policy_names)} policy changes for {today}")

            preview = ", ".join(policy_names[:5])
            if len(policy_names) > 5:
                preview += f" (+{len(policy_names) - 5} more)"

            fields = [
                ("Policies", str(len(policy_names)), True),
                ("Date", today, True),
            ]
            if commit_url:
                fields.append(("Commit", f"[View]({commit_url})", True))

            discord.send(
                "Policy Changes Recorded",
                preview,
                discord.COLOR_SUCCESS,
                fields=fields,
            )

        except Exception as e:
            print(f"Error processing record: {e}")
            discord.send(
                "Change Recorder Error",
                f"```{traceback.format_exc()[-1000:]}```",
                discord.COLOR_ERROR,
            )
            raise
