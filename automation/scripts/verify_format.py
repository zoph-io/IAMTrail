#!/usr/bin/env python3
"""Verify that the Python serialization produces byte-identical output to existing policy files.

This script does NOT require AWS credentials. It reads every file in the policies/
directory, parses the JSON, re-serializes it using the same logic as fetch_policies.py,
and confirms the output matches byte-for-byte.

Usage:
    python3 verify_format.py [policies_dir]

If no directory is specified, defaults to ../../policies/ relative to this script.
"""

import json
import os
import sys


def serialize_policy(data):
    """Reproduce the exact serialization used by fetch_policies.py and the CLI pipeline."""
    return json.dumps(data, indent=4, default=str) + "\n"


def main():
    if len(sys.argv) > 1:
        policies_dir = sys.argv[1]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        policies_dir = os.path.join(script_dir, "..", "..", "policies")

    policies_dir = os.path.abspath(policies_dir)

    if not os.path.isdir(policies_dir):
        print(f"ERROR: Directory not found: {policies_dir}", file=sys.stderr)
        sys.exit(1)

    files = sorted(f for f in os.listdir(policies_dir) if not f.startswith("."))
    total = len(files)
    passed = 0
    failed = 0
    errors = []

    for filename in files:
        filepath = os.path.join(policies_dir, filename)
        if not os.path.isfile(filepath):
            continue

        with open(filepath, "rb") as f:
            raw = f.read()

        has_crlf = b"\r\n" in raw
        if has_crlf:
            errors.append(f"  CRLF: {filename} contains \\r\\n line endings")
            failed += 1
            continue

        if not raw.endswith(b"\n"):
            errors.append(f"  NO_TRAILING_LF: {filename} missing trailing newline")
            failed += 1
            continue

        trailing_newlines = len(raw) - len(raw.rstrip(b"\n"))
        if trailing_newlines > 1:
            errors.append(
                f"  EXTRA_LF: {filename} has {trailing_newlines} trailing newlines"
            )
            failed += 1
            continue

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            errors.append(f"  JSON_ERROR: {filename}: {e}")
            failed += 1
            continue

        expected = serialize_policy(data).encode("utf-8")

        if raw == expected:
            passed += 1
        else:
            failed += 1
            for i, (a, b) in enumerate(zip(raw, expected)):
                if a != b:
                    errors.append(
                        f"  DIFF: {filename} at byte {i}: "
                        f"file=0x{a:02x}('{chr(a)}') vs expected=0x{b:02x}('{chr(b)}')"
                    )
                    break
            else:
                if len(raw) != len(expected):
                    errors.append(
                        f"  SIZE: {filename}: file={len(raw)} bytes vs expected={len(expected)} bytes"
                    )

    print(f"Format verification: {total} files checked")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}")

    if errors:
        print("\nFailures:")
        for e in errors[:20]:
            print(e)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")

    if failed > 0:
        sys.exit(1)
    else:
        print("\nAll files match the Python serialization exactly. Safe to switch.")
        sys.exit(0)


if __name__ == "__main__":
    main()
