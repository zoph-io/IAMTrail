# Notifications and social channels

## Bluesky

IAM policies (ECS runbook), GuardDuty (Lambda + optional GitHub sync), and endpoint changes (GitHub Actions) enqueue plain text to the FIFO queue consumed by `qbsky-mamip-prod` in `eu-west-1`. Posts are prefixed with `[Policies]`, `[GuardDuty]`, or `[Endpoints]` on [@iamtrail.bsky.social](https://bsky.app/profile/iamtrail.bsky.social).

## Discord

- **Internal ops** (`/iamtrail/discord-webhook-url` in SSM): errors, run summaries, and operator alerts. Used by Lambdas via `DISCORD_WEBHOOK_SSM` and by `runbook-prod.sh` for failures.
- **Invite-only channel** (`/iamtrail/discord-public-webhook-url` in SSM, SecureString): same high-level events as Bluesky for a private Discord audience. Not linked from the public website (iamtrail.com only promotes Bluesky and RSS). Lambdas and the runbook read the webhook from SSM; GitHub Actions use the OIDC role.

## X / Twitter

Posting is **disabled** in code (Feb 2026 X API pay-per-use). `automation/scripts/x_poster.py` and `iamtrail/social/*` secrets are kept for a possible future re-enable.

## GitHub Actions IAM

The `GhA-MAMIP-Role` policy in [`automation/github-actions-iam-policy.json`](../automation/github-actions-iam-policy.json) includes:

- `sqs:SendMessage` on `arn:aws:sqs:eu-west-1:567589703415:qbsky-mamip-prod-sqs-queue.fifo` (Bluesky queue).
- `ssm:GetParameter` on `arn:aws:ssm:eu-west-1:567589703415:parameter/iamtrail/*` (shared GitHub Actions policy size limit - covers both Discord webhook parameters under `/iamtrail/`).

After editing that JSON, apply the Terraform attachment (or attach the policy to the role manually) so workflows can post.
