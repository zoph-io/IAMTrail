#!/usr/bin/env python3
"""Quick test: post a test tweet using the @mgda_aws credentials."""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
import x_poster

ok = x_poster.post(
    "Test post from IAMTrail x_poster.py - please ignore",
    "iamtrail/social/mgda",
    region="eu-west-1",
)

if ok:
    print("Success - delete the test tweet manually from X")
else:
    print("Failed - check the error above")
    sys.exit(1)
