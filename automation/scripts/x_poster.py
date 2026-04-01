"""
Post tweets to X/Twitter using OAuth 1.0a (HMAC-SHA1).
Pure stdlib implementation - no tweepy or requests_oauthlib needed.
Credentials are fetched from AWS Secrets Manager.

Usage as module:
    import x_poster
    x_poster.post("Hello world", "iamtrail/social/mase")

Usage as CLI:
    python3 x_poster.py --secret iamtrail/social/mase --region eu-west-1 "Hello world"
"""

import argparse
import json
import hashlib
import hmac
import base64
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

_secrets_client = None
_cached_credentials = {}

TWITTER_API_URL = "https://api.twitter.com/2/tweets"


def _get_client(region=None):
    global _secrets_client
    if _secrets_client is None:
        import boto3
        kwargs = {}
        if region:
            kwargs["region_name"] = region
        _secrets_client = boto3.client("secretsmanager", **kwargs)
    return _secrets_client


def _get_credentials(secret_id, region=None):
    if secret_id in _cached_credentials:
        return _cached_credentials[secret_id]
    if not secret_id:
        return None
    try:
        client = _get_client(region)
        resp = client.get_secret_value(SecretId=secret_id)
        creds = json.loads(resp["SecretString"])
        _cached_credentials[secret_id] = creds
        return creds
    except Exception as e:
        print(f"[x_poster] Failed to retrieve credentials: {e}")
        return None


def _resolve_key(creds, *candidates):
    """Return the first non-empty value found for the given key candidates."""
    for key in candidates:
        val = creds.get(key, "")
        if val:
            return val
    return ""


def _percent_encode(s):
    return urllib.parse.quote(str(s), safe="")


def _build_oauth_header(method, url, params, consumer_key, consumer_secret,
                         access_token, token_secret):
    oauth_params = {
        "oauth_consumer_key": consumer_key,
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }

    all_params = {**params, **oauth_params}
    sorted_params = "&".join(
        f"{_percent_encode(k)}={_percent_encode(v)}"
        for k, v in sorted(all_params.items())
    )

    base_string = "&".join([
        method.upper(),
        _percent_encode(url),
        _percent_encode(sorted_params),
    ])

    signing_key = f"{_percent_encode(consumer_secret)}&{_percent_encode(token_secret)}"
    signature = base64.b64encode(
        hmac.new(
            signing_key.encode("utf-8"),
            base_string.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("utf-8")

    oauth_params["oauth_signature"] = signature

    header = "OAuth " + ", ".join(
        f'{_percent_encode(k)}="{_percent_encode(v)}"'
        for k, v in sorted(oauth_params.items())
    )
    return header


def post(text, secret_id, region=None):
    """Post a tweet. Never raises - logs errors instead."""
    if not secret_id or not text:
        return False

    creds = _get_credentials(secret_id, region)
    if not creds:
        print("[x_poster] No credentials available, skipping tweet")
        return False

    consumer_key = _resolve_key(creds, "x_api_key", "api_key")
    consumer_secret = _resolve_key(creds, "x_api_secret", "api_secret")
    access_token = _resolve_key(creds, "x_access_token", "access_token")
    token_secret = _resolve_key(creds, "x_access_token_secret", "access_token_secret")

    if not all([consumer_key, consumer_secret, access_token, token_secret]):
        print("[x_poster] Incomplete credentials, skipping tweet")
        return False

    payload = json.dumps({"text": text}).encode("utf-8")

    auth_header = _build_oauth_header(
        "POST", TWITTER_API_URL, {},
        consumer_key, consumer_secret, access_token, token_secret,
    )

    try:
        req = urllib.request.Request(
            TWITTER_API_URL,
            data=payload,
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/json",
                "User-Agent": "IAMTrail/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            print(f"[x_poster] Tweet posted successfully: {resp_body[:200]}")
            return True
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        print(f"[x_poster] Failed to post tweet: {e.code} {e.reason}")
        if body:
            print(f"[x_poster] Response body: {body[:500]}")
        return False
    except Exception as e:
        print(f"[x_poster] Failed to post tweet: {e}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Post to X/Twitter via Secrets Manager credentials")
    parser.add_argument("message", help="Tweet text to post")
    parser.add_argument("--secret", required=True, help="Secrets Manager secret name or ARN")
    parser.add_argument("--region", default=None, help="AWS region for Secrets Manager")
    args = parser.parse_args()

    ok = post(args.message, args.secret, region=args.region)
    sys.exit(0 if ok else 1)
