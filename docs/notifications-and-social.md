# Notifications and social channels

## Bluesky

IAM policies (ECS runbook), GuardDuty (Lambda + optional GitHub sync), and endpoint changes (GitHub Actions) enqueue plain text to the FIFO queue consumed by `qbsky-mamip-prod` in `eu-west-1`. Posts are prefixed with `[Policies]`, `[GuardDuty]`, or `[Endpoints]` on [@iamtrail.bsky.social](https://bsky.app/profile/iamtrail.bsky.social).

## Discord

- **Internal ops** (`/iamtrail/discord-webhook-url` in SSM): errors, run summaries, and operator alerts. Used by Lambdas via `DISCORD_WEBHOOK_SSM` and by `runbook-prod.sh` for failures.
- **Invite-only channel** (`/iamtrail/discord-public-webhook-url` in SSM, SecureString): same high-level events as Bluesky for a private Discord audience. Not linked from the public website (iamtrail.com only promotes Bluesky and RSS). Lambdas and the runbook read the webhook from SSM; GitHub Actions use the OIDC role.

## X / Twitter

Posting is **disabled** in code (Feb 2026 X API pay-per-use). `automation/scripts/x_poster.py` and `iamtrail/social/*` secrets are kept for a possible future re-enable.

## GitHub Actions IAM

`GhA-MAMIP-Role` uses **three** customer-managed policies (split to stay under the 6,144 character limit per policy). The JSON files live in `automation/`: [github-actions-01-s3-foundation.json](../automation/github-actions-01-s3-foundation.json) (S3, ECS, ECR, CloudWatch logs, CloudFront, R53, ACM, Events, misc read), [github-actions-02-iam.json](../automation/github-actions-02-iam.json) (IAM for Terraform and self-attach to this role), and [github-actions-03-services.json](../automation/github-actions-03-services.json) (DDB, Lambda, SQS, SNS, API Gateway, Secrets, SSM, `cloudwatch:GetMetricStatistics`, and other services).

- `sqs:SendMessage` on the Bluesky FIFO queue and related permissions are in `03-services`.
- `ssm:GetParameter` on `arn:aws:ssm:eu-west-1:567589703415:parameter/iamtrail/*` (Discord webhooks under `/iamtrail/`) is in `03-services`.

`aws_iam_policy` / `aws_iam_role_policy_attachment` in [`automation/tf-fargate/iam.tf`](../automation/tf-fargate/iam.tf) apply these. After changing any fragment, `terraform apply` the `automation/tf-fargate` stack.
