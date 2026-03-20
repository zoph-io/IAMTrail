"""
Post tweets to X/Twitter using OAuth 1.0a (HMAC-SHA1).
Pure stdlib implementation - no tweepy or requests_oauthlib needed.
Credentials are fetched from AWS Secrets Manager.
"""

import json
import hashlib
import hmac
import base64
import time
import urllib.parse
import urllib.request
import uuid
import boto3

_secrets_client = boto3.client("secretsmanager")
_cached_credentials = {}

TWITTER_API_URL = "https://api.twitter.com/2/tweets"


def _get_credentials(secret_arn):
    if secret_arn in _cached_credentials:
        return _cached_credentials[secret_arn]
    if not secret_arn:
        return None
    try:
        resp = _secrets_client.get_secret_value(SecretId=secret_arn)
        creds = json.loads(resp["SecretString"])
        _cached_credentials[secret_arn] = creds
        return creds
    except Exception as e:
        print(f"[x_poster] Failed to retrieve credentials: {e}")
        return None


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


def post(text, secret_arn):
    """Post a tweet. Never raises - logs errors instead."""
    if not secret_arn or not text:
        return

    creds = _get_credentials(secret_arn)
    if not creds:
        print("[x_poster] No credentials available, skipping tweet")
        return

    consumer_key = creds.get("api_key", "")
    consumer_secret = creds.get("api_secret", "")
    access_token = creds.get("access_token", "")
    token_secret = creds.get("access_token_secret", "")

    if not all([consumer_key, consumer_secret, access_token, token_secret]):
        print("[x_poster] Incomplete credentials, skipping tweet")
        return

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
                "User-Agent": "MGDA-GuardDuty-Monitor/2.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            print(f"[x_poster] Tweet posted successfully: {resp_body[:200]}")
    except Exception as e:
        print(f"[x_poster] Failed to post tweet: {e}")
