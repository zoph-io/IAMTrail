import json
import os
import uuid
import time
import re
import traceback
import boto3
from boto3.dynamodb.conditions import Key
import discord_notifier as discord

dynamodb = boto3.resource("dynamodb")
ses = boto3.client("ses", region_name=os.environ.get("SES_REGION", "eu-west-3"))

TABLE_NAME = os.environ["SUBSCRIPTIONS_TABLE"]
SENDER_EMAIL = os.environ["SENDER_EMAIL"]
SITE_URL = os.environ["SITE_URL"]
API_URL = os.environ["API_URL"]

table = dynamodb.Table(TABLE_NAME)

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def redirect(url):
    return {
        "statusCode": 302,
        "headers": {"Location": url},
        "body": "",
    }


def send_email(to, subject, html_body):
    ses.send_email(
        Source=SENDER_EMAIL,
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Html": {"Data": html_body}},
        },
    )


def handle_subscribe(body):
    email = body.get("email", "").strip().lower()
    policies = body.get("policies", ["*"])
    frequency = body.get("frequency", "daily")

    if not email or not EMAIL_RE.match(email):
        return respond(400, {"error": "Invalid email address"})

    if frequency not in ("daily", "weekly", "instant"):
        return respond(400, {"error": "Frequency must be 'daily', 'weekly', or 'instant'"})

    existing = table.get_item(Key={"email": email}).get("Item")
    if existing and existing.get("confirmed"):
        return respond(409, {"error": "Email already subscribed. Check your inbox for the manage link."})

    confirm_token = str(uuid.uuid4())
    manage_token = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    table.put_item(
        Item={
            "email": email,
            "confirm_token": confirm_token,
            "manage_token": manage_token,
            "confirmed": False,
            "policies": policies,
            "frequency": frequency,
            "created_at": now,
            "updated_at": now,
            "ttl": int(time.time()) + 86400,  # 24h expiry for unconfirmed
        }
    )

    discord.send(
        "New Subscriber",
        f"{discord.mask_email(email)} signed up",
        discord.COLOR_INFO,
        fields=[
            ("Frequency", frequency, True),
            ("Policies", ", ".join(policies[:5]) if policies != ["*"] else "All", True),
        ],
    )

    confirm_url = f"{API_URL}/confirm/{confirm_token}"
    send_email(
        email,
        "Confirm your IAMTrail subscription",
        f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Confirm your IAMTrail subscription</h2>
            <p style="color: #475569;">Click the button below to confirm your subscription to AWS Managed Policy change notifications.</p>
            <p style="margin: 24px 0;">
                <a href="{confirm_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Confirm Subscription
                </a>
            </p>
            <p style="color: #94a3b8; font-size: 14px;">
                If you didn't request this, you can safely ignore this email. The link expires in 24 hours.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">
                <a href="{SITE_URL}" style="color: #2563eb;">IAMTrail</a> - AWS Managed Policy Changes Archive by <a href="https://zoph.io" style="color: #2563eb;">zoph.io</a>
            </p>
        </div>
        """,
    )

    return respond(200, {"message": "Confirmation email sent. Please check your inbox."})


def handle_confirm(token):
    result = table.scan(
        FilterExpression="confirm_token = :t",
        ExpressionAttributeValues={":t": token},
    )
    items = result.get("Items", [])

    if not items:
        # Token not found - maybe already confirmed (confirm_token is removed after confirmation).
        # Redirect to a friendly page instead of an error.
        return redirect(f"{SITE_URL}/subscribe/?status=already_confirmed")

    item = items[0]

    if item.get("confirmed"):
        return redirect(f"{SITE_URL}/manage/?token={item['manage_token']}")

    table.update_item(
        Key={"email": item["email"]},
        UpdateExpression="SET confirmed = :c, updated_at = :u REMOVE #ttl, confirm_token",
        ExpressionAttributeNames={"#ttl": "ttl"},
        ExpressionAttributeValues={
            ":c": True,
            ":u": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )

    discord.send(
        "Subscriber Confirmed",
        f"{discord.mask_email(item['email'])} confirmed their subscription",
        discord.COLOR_SUCCESS,
        fields=[("Frequency", item.get("frequency", "daily"), True)],
    )

    return redirect(f"{SITE_URL}/manage/?token={item['manage_token']}&confirmed=true")


def handle_get_manage(token):
    result = table.query(
        IndexName="manage_token-index",
        KeyConditionExpression=Key("manage_token").eq(token),
    )
    items = result.get("Items", [])

    if not items:
        return respond(404, {"error": "Subscription not found"})

    item = items[0]
    if not item.get("confirmed"):
        return respond(403, {"error": "Subscription not yet confirmed"})

    return respond(200, {
        "email": item["email"],
        "policies": item.get("policies", ["*"]),
        "frequency": item.get("frequency", "daily"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    })


def handle_put_manage(token, body):
    result = table.query(
        IndexName="manage_token-index",
        KeyConditionExpression=Key("manage_token").eq(token),
    )
    items = result.get("Items", [])

    if not items:
        return respond(404, {"error": "Subscription not found"})

    item = items[0]
    if not item.get("confirmed"):
        return respond(403, {"error": "Subscription not yet confirmed"})

    policies = body.get("policies", item.get("policies", ["*"]))
    frequency = body.get("frequency", item.get("frequency", "daily"))

    if frequency not in ("daily", "weekly", "instant"):
        return respond(400, {"error": "Frequency must be 'daily', 'weekly', or 'instant'"})

    table.update_item(
        Key={"email": item["email"]},
        UpdateExpression="SET policies = :p, frequency = :f, updated_at = :u",
        ExpressionAttributeValues={
            ":p": policies,
            ":f": frequency,
            ":u": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )

    return respond(200, {"message": "Subscription updated"})


def handle_delete_manage(token):
    result = table.query(
        IndexName="manage_token-index",
        KeyConditionExpression=Key("manage_token").eq(token),
    )
    items = result.get("Items", [])

    if not items:
        return respond(404, {"error": "Subscription not found"})

    email = items[0]["email"]
    table.delete_item(Key={"email": email})

    discord.send(
        "Subscriber Removed",
        f"{discord.mask_email(email)} unsubscribed",
        discord.COLOR_WARNING,
    )

    return respond(200, {"message": "Unsubscribed successfully"})


def handle_resend_manage_link(body):
    email = body.get("email", "").strip().lower()

    if not email or not EMAIL_RE.match(email):
        return respond(400, {"error": "Invalid email address"})

    # Always return success to prevent email enumeration
    item = table.get_item(Key={"email": email}).get("Item")
    if item and item.get("confirmed"):
        manage_url = f"{SITE_URL}/manage?token={item['manage_token']}"
        send_email(
            email,
            "Your IAMTrail subscription manage link",
            f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e293b;">Manage your IAMTrail subscription</h2>
                <p style="color: #475569;">Click the button below to manage your policy change notification preferences.</p>
                <p style="margin: 24px 0;">
                    <a href="{manage_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Manage Subscription
                    </a>
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">
                    <a href="{SITE_URL}" style="color: #2563eb;">IAMTrail</a> - AWS Managed Policy Changes Archive by <a href="https://zoph.io" style="color: #2563eb;">zoph.io</a>
                </p>
            </div>
            """,
        )

    return respond(200, {"message": "If this email is registered, a manage link has been sent."})


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")

    try:
        body = json.loads(event.get("body", "{}") or "{}")
    except json.JSONDecodeError:
        body = {}

    try:
        if method == "POST" and path == "/subscribe":
            return handle_subscribe(body)

        if method == "GET" and path.startswith("/confirm/"):
            token = path.split("/confirm/")[1]
            return handle_confirm(token)

        if method == "GET" and path.startswith("/manage/"):
            token = path.split("/manage/")[1]
            return handle_get_manage(token)

        if method == "PUT" and path.startswith("/manage/"):
            token = path.split("/manage/")[1]
            return handle_put_manage(token, body)

        if method == "DELETE" and path.startswith("/manage/"):
            token = path.split("/manage/")[1]
            return handle_delete_manage(token)

        if method == "POST" and path == "/resend-manage-link":
            return handle_resend_manage_link(body)

        return respond(404, {"error": "Not found"})

    except Exception as e:
        discord.send(
            "Subscription API Error",
            f"```{traceback.format_exc()[-1000:]}```",
            discord.COLOR_ERROR,
            fields=[("Method", method, True), ("Path", path, True)],
        )
        raise
