#!/usr/bin/env python3
"""Fetch all AWS-managed IAM policies and write them to disk.

Replaces the xargs + AWS CLI pipeline with a single boto3 process
using threaded parallelism for ~10x faster execution.

Usage:
    python3 fetch_policies.py <output_dir>
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from botocore.config import Config

WORKERS = 32
REGION = os.environ.get("AWS_REGION", "eu-west-1")

config = Config(
    region_name=REGION,
    retries={"max_attempts": 5, "mode": "adaptive"},
    max_pool_connections=WORKERS,
)


def log(msg):
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}", flush=True)


def list_aws_managed_policies(iam):
    """Return list of AWS-managed policies (arn contains iam::aws)."""
    policies = []
    paginator = iam.get_paginator("list_policies")
    for page in paginator.paginate(Scope="AWS"):
        for p in page["Policies"]:
            if "iam::aws" in p["Arn"]:
                policies.append(p)
    return policies


def fetch_and_write(iam, arn, version_id, output_path):
    """Fetch a single policy version and write to disk.

    Reproduces the exact output of:
        aws iam get-policy-version --policy-arn ARN --version-id VER | jq --indent 4 .
    which is equivalent to json.dumps(indent=4) + trailing newline, with LF line endings.
    """
    resp = iam.get_policy_version(PolicyArn=arn, VersionId=version_id)
    pv = resp["PolicyVersion"]

    create_date = pv.get("CreateDate")

    payload = {
        "PolicyVersion": {
            "Document": pv["Document"],
            "VersionId": pv["VersionId"],
            "IsDefaultVersion": pv["IsDefaultVersion"],
            "CreateDate": (
                create_date.strftime("%Y-%m-%dT%H:%M:%S+00:00")
                if hasattr(create_date, "strftime")
                else str(create_date)
            ),
        }
    }

    serialized = json.dumps(payload, indent=4, default=str) + "\n"

    with open(output_path, "w", newline="\n") as f:
        f.write(serialized)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <output_dir>", file=sys.stderr)
        sys.exit(1)

    output_dir = sys.argv[1]
    os.makedirs(output_dir, exist_ok=True)

    iam = boto3.client("iam", config=config)

    log("Listing AWS managed policies...")
    t0 = time.time()
    policies = list_aws_managed_policies(iam)
    log(f"Found {len(policies)} AWS managed policies ({time.time() - t0:.1f}s)")

    log(f"Fetching policy versions with {WORKERS} threads...")
    t0 = time.time()
    done = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {}
        for p in policies:
            output_path = os.path.join(output_dir, p["PolicyName"])
            fut = pool.submit(
                fetch_and_write, iam, p["Arn"], p["DefaultVersionId"], output_path
            )
            futures[fut] = p["PolicyName"]

        for fut in as_completed(futures):
            name = futures[fut]
            try:
                fut.result()
                done += 1
                if done % 100 == 0:
                    log(f"  Progress: {done}/{len(policies)}")
            except Exception as e:
                errors += 1
                log(f"  ERROR fetching {name}: {e}")

    elapsed = time.time() - t0
    log(f"Fetched {done} policies in {elapsed:.1f}s ({errors} errors)")

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
