import json
import os
import time
import urllib.request
import boto3

COLOR_SUCCESS = 0x2ECC71
COLOR_INFO = 0x3498DB
COLOR_WARNING = 0xF39C12
COLOR_ERROR = 0xE74C3C

_ssm = boto3.client("ssm")
_webhook_url = None


def _get_webhook_url():
    global _webhook_url
    if _webhook_url:
        return _webhook_url
    param_name = os.environ.get("DISCORD_WEBHOOK_SSM", "")
    if not param_name:
        return None
    try:
        resp = _ssm.get_parameter(Name=param_name, WithDecryption=True)
        _webhook_url = resp["Parameter"]["Value"]
        return _webhook_url
    except Exception as e:
        print(f"[discord_notifier] Failed to read SSM parameter: {e}")
        return None


def mask_email(email):
    """Mask an email for privacy: v***r@zoph.io"""
    try:
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked = local[0] + "***"
        else:
            masked = local[0] + "***" + local[-1]
        return f"{masked}@{domain}"
    except Exception:
        return "***@***"


def send(title, description="", color=COLOR_INFO, fields=None, footer=None):
    """Send a Discord embed notification. Never raises - logs errors instead."""
    url = _get_webhook_url()
    if not url:
        return

    embed = {
        "title": title,
        "color": color,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    if description:
        embed["description"] = description

    if fields:
        embed["fields"] = [
            {"name": str(f[0]), "value": str(f[1]), "inline": f[2] if len(f) > 2 else True}
            for f in fields
        ]

    source = os.environ.get("AWS_LAMBDA_FUNCTION_NAME", "unknown")
    footer_text = f"IAMTrail - {source}"
    if footer:
        footer_text = f"{footer} - {source}"
    embed["footer"] = {"text": footer_text}

    payload = json.dumps({"embeds": [embed]}).encode("utf-8")

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "IAMTrail-Notifier/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception as e:
        print(f"[discord_notifier] Failed to send Discord notification: {e}")
