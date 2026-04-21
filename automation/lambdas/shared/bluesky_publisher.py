"""
Enqueue a plain-text post for @iamtrail.bsky.social.

The FIFO queue is consumed by the qbsky-mamip-prod Lambda (outside this repo).
Message body must stay under ~300 chars (Bluesky post limit).
"""

import os

import boto3

_sqs_client = None
QUEUE_URL = os.environ.get("BLUESKY_QUEUE_URL", "")


def _client():
    global _sqs_client
    if _sqs_client is None:
        _sqs_client = boto3.client(
            "sqs", region_name=os.environ.get("AWS_REGION", "eu-west-1")
        )
    return _sqs_client


def post(text, group_id="1"):
    """Send text to the Bluesky FIFO queue. Never raises - logs errors instead."""
    if not QUEUE_URL or not text:
        return False
    try:
        _client().send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=text,
            MessageGroupId=str(group_id),
        )
        return True
    except Exception as e:
        print(f"[bluesky_publisher] Failed to enqueue Bluesky post: {e}")
        return False
