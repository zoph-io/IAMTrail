
resource "aws_iam_role" "ecs_role" {
  name               = "${var.project}_ecs_role_${var.env}"
  assume_role_policy = data.aws_iam_policy_document.ecs_service_assume_role_policy.json
}

data "aws_iam_policy_document" "ecs_service_policy" {
  statement {
    effect = "Allow"
    resources = [
      "arn:aws:s3:::mamip-artifacts/*"
    ]
    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]
  }
  statement {
    effect    = "Allow"
    resources = ["*"]
    actions = [
      "iam:ListPolicies",
      "iam:GetPolicyVersion"
    ]
  }
  statement {
    effect    = "Allow"
    resources = ["*"]
    actions = [
      "access-analyzer:ValidatePolicy"
    ]
  }
  statement {
    effect = "Allow"
    resources = [
      "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.qbsky_sqs_name}.fifo",
      "arn:aws:sqs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.qmasto_sqs_name}.fifo"
    ]
    actions = [
      "sqs:SendMessage"
    ]
  }
  statement {
    effect    = "Allow"
    resources = ["arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:mamip-sns-topic"]
    actions = [
      "sns:Publish"
    ]
  }
  statement {
    effect = "Allow"
    resources = [
      "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:mamip/prod/github-*",
      "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:iamtrail/social/iamtrail-*"
    ]
    actions = [
      "secretsmanager:GetSecretValue"
    ]
  }
  statement {
    effect = "Allow"
    resources = [
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/iamtrail/discord-webhook-url",
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/iamtrail/discord-public-webhook-url"
    ]
    actions = [
      "ssm:GetParameter"
    ]
  }
}

data "aws_iam_policy_document" "ecs_service_assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

/* ecs service scheduler role */
resource "aws_iam_role_policy" "ecs_service_role_policy" {
  name   = "${var.project}_ecs_service_role_policy_${var.env}"
  policy = data.aws_iam_policy_document.ecs_service_policy.json
  role   = aws_iam_role.ecs_role.id
}

# ──────────────────────────────────────────────
# GitHub Actions IAM: three managed policies (6,144 character limit per policy).
# Replaces the former `iamtrail-github-actions-policy` single document.
# Apply once: state drops `github_actions` + attachment and creates these
# (Terraform usually creates the new policies and attachments before destroying
# the old managed policy, but if you see a denied workflow mid-apply, re-run apply).
# ──────────────────────────────────────────────

resource "aws_iam_policy" "github_actions_s3_foundation" {
  name        = "iamtrail-github-actions-01-s3-foundation"
  description = "GitHub Actions: S3/website, ECS, ECR, CloudWatch logs, CloudFront, R53, ACM, Events."
  policy      = file("${path.module}/../github-actions-01-s3-foundation.json")
  tags        = var.tags
}

resource "aws_iam_policy" "github_actions_iam" {
  name        = "iamtrail-github-actions-02-iam"
  description = "GitHub Actions: IAM role and customer-managed policy for Terraform and self-attach to GhA-MAMIP-Role."
  policy      = file("${path.module}/../github-actions-02-iam.json")
  tags        = var.tags
}

resource "aws_iam_policy" "github_actions_services" {
  name        = "iamtrail-github-actions-03-services"
  description = "GitHub Actions: DDB, Lambda, API Gateway, SQS, SNS, Secrets, SSM, GetMetricStatistics (e.g. SES / usage page)."
  policy      = file("${path.module}/../github-actions-03-services.json")
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "github_actions_s3_foundation" {
  role       = "GhA-MAMIP-Role"
  policy_arn = aws_iam_policy.github_actions_s3_foundation.arn
}

resource "aws_iam_role_policy_attachment" "github_actions_iam" {
  role       = "GhA-MAMIP-Role"
  policy_arn = aws_iam_policy.github_actions_iam.arn
}

resource "aws_iam_role_policy_attachment" "github_actions_services" {
  role       = "GhA-MAMIP-Role"
  policy_arn = aws_iam_policy.github_actions_services.arn
}

# SNS Topic Policy to allow CloudWatch Events to publish
resource "aws_sns_topic_policy" "ecs_task_failure_policy" {
  arn = aws_sns_topic.ecs_task_failure.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.ecs_task_failure.arn
      }
    ]
  })
}
