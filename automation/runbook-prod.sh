#!/bin/bash

set -euo pipefail

###################
# Global Variables #
###################

# Date format for tagging
DATE=$(date +%Y-%m-%d-%H-%M)

# Repository settings
REPO_URL="https://github.com/zoph-io/IAMTrail.git"
REPO_PATH="/tmp/IAMTrail"
GIT_USER_NAME="MAMIP Bot"
GIT_USER_EMAIL="mamip_bot@github.com"

# AWS settings
REGION="eu-west-1"
GITHUB_SECRET_ARN="arn:aws:secretsmanager:eu-west-1:567589703415:secret:mamip/prod/github-MSzGtP"
SNS_TOPIC_ARN="arn:aws:sns:eu-west-1:567589703415:mamip-sns-topic"
SQS_BLUESKY_URL="https://sqs.eu-west-1.amazonaws.com/567589703415/qbsky-mamip-prod-sqs-queue.fifo"
DISCORD_WEBHOOK_SSM="/iamtrail/discord-webhook-url"

# File processing
WORD_TO_REMOVE="policies/"

######################
# Utility Functions  #
######################

# Function to log messages
log() {
    local message="$1"
    echo "$(date +'%Y-%m-%d %H:%M:%S') - $message"
}

# Retrieve Discord webhook URL from SSM (cached)
DISCORD_WEBHOOK_URL=""
get_discord_webhook() {
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        return
    fi
    DISCORD_WEBHOOK_URL=$(aws ssm get-parameter \
        --name "$DISCORD_WEBHOOK_SSM" \
        --with-decryption \
        --region "$REGION" \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || true)
}

# Send a Discord embed notification
# Usage: discord_notify <color_decimal> <title> <description> [field_name:field_value ...]
discord_notify() {
    get_discord_webhook
    if [ -z "$DISCORD_WEBHOOK_URL" ]; then
        return
    fi

    local color="$1"
    local title="$2"
    local description="$3"
    shift 3

    local fields=""
    for field in "$@"; do
        local fname="${field%%:*}"
        local fvalue="${field#*:}"
        if [ -n "$fields" ]; then
            fields="$fields,"
        fi
        fields="$fields{\"name\":\"$fname\",\"value\":\"$fvalue\",\"inline\":true}"
    done

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local payload
    if [ -n "$fields" ]; then
        payload="{\"embeds\":[{\"title\":\"$title\",\"description\":\"$description\",\"color\":$color,\"fields\":[$fields],\"footer\":{\"text\":\"IAMTrail - runbook-prod\"},\"timestamp\":\"$timestamp\"}]}"
    else
        payload="{\"embeds\":[{\"title\":\"$title\",\"description\":\"$description\",\"color\":$color,\"footer\":{\"text\":\"IAMTrail - runbook-prod\"},\"timestamp\":\"$timestamp\"}]}"
    fi

    curl -s -o /dev/null -H "Content-Type: application/json" -d "$payload" "$DISCORD_WEBHOOK_URL" || true
}

# Function to handle errors
error_handler() {
    discord_notify 15158332 "Runbook Error" "An error occurred during the MAMIP update process"
    log "An error occurred. Exiting..."
    exit 1
}

# Trap errors
trap error_handler ERR

########################
# Repository Functions #
########################

# Set up GitHub token and Git configuration
setup_git_auth() {
    log "Setting up GitHub authentication and Git configuration"
    
    # Retrieve GitHub token from Secrets Manager
    GITHUB_TOKEN=$(aws secretsmanager get-secret-value \
        --secret-id "$GITHUB_SECRET_ARN" \
        --region "$REGION" \
        --query 'SecretString' \
        --output text | jq -r '.github_token')
    
    if [ -z "$GITHUB_TOKEN" ] || [ "$GITHUB_TOKEN" = "null" ]; then
        log "Failed to retrieve GitHub token from Secrets Manager"
        discord_notify 15158332 "Git Auth Failed" "Could not retrieve GitHub token from Secrets Manager"
        exit 1
    fi

    git config --global user.name "$GIT_USER_NAME"
    git config --global user.email "$GIT_USER_EMAIL"
    
    # Configure Git to use the token for HTTPS authentication
    git config --global credential.helper store
    echo "https://x-access-token:$GITHUB_TOKEN@github.com" > /home/mamip/.git-credentials
    chmod 600 /home/mamip/.git-credentials
}

# Clone the repository
clone_repo() {
    log "Cloning the repository"
    cd /tmp/
    git clone "$REPO_URL" -q
    if [ ! -d "$REPO_PATH" ]; then
        log "Failed to clone repository"
        discord_notify 15158332 "Clone Failed" "Repository clone succeeded but expected path $REPO_PATH not found. Check REPO_URL vs REPO_PATH."
        exit 1
    fi
    log "Repository cloned successfully"
}

#########################
# Processing Functions  #
#########################

# Process IAM policies
process_policies() {
    log "Processing IAM policies"
    cd "$REPO_PATH"
    aws iam list-policies --output json |
        jq -cr '.Policies[] | select(.Arn | contains("iam::aws")) | .Arn + " " + .DefaultVersionId + " " + .PolicyName' |
        xargs -P 16 -n3 sh -c 'mkdir -p policies && aws iam get-policy-version --policy-arn $1 --version-id $2 | jq --indent 4 . > "policies/$3"' sh
}

# Send notifications to various platforms
send_notifications() {
    local message_body="$1"
    local sns_message="$2"

    # X/Twitter
    python3 "$REPO_PATH/automation/scripts/x_poster.py" \
        --secret "iamtrail/social/iamtrail" \
        --region "$REGION" \
        "$message_body" || true

    # Bluesky
    aws sqs send-message \
        --queue-url "$SQS_BLUESKY_URL" \
        --message-body "$message_body" \
        --message-group-id 1

    # SNS
    aws sns publish \
        --topic-arn "$SNS_TOPIC_ARN" \
        --message "$sns_message" \
        --region "$REGION"
}

# Extract policy version from JSON file
get_policy_version() {
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        jq -r '.PolicyVersion.VersionId // "unknown"' "$file_path" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Handle git changes and notifications
process_changes() {
    log "Processing changes"
    if [[ -n $(git status -s) ]]; then
        # Get all changed files
        CHANGED_FILES="$(git diff --name-only) $(git ls-files --others --exclude-standard)"
        ALL_COMMITS=()
        declare -A POLICY_COMMIT_MAP
        
        # Process each changed file individually
        for file in $CHANGED_FILES; do
            if [[ "$file" == policies/* ]]; then
                POLICY_NAME=$(basename "$file")
                POLICY_VERSION=$(get_policy_version "$file")
                COMMIT_MESSAGE="$POLICY_NAME - Policy Version $POLICY_VERSION"
                
                log "Committing $file with version $POLICY_VERSION"
                git add "$file"
                git commit -m "$COMMIT_MESSAGE"
                COMMIT_ID=$(git log --format="%h" -n 1)
                ALL_COMMITS+=("$COMMIT_ID")
                POLICY_COMMIT_MAP["$POLICY_NAME"]="$COMMIT_ID"
            fi
        done

        # If we have commits, prepare notifications and push
        if [[ ${#ALL_COMMITS[@]} -gt 0 ]]; then
            # Get list of updated policies for notification
            POLICY_NAMES=$(echo "$CHANGED_FILES" | grep "^policies/" | sed "s|^policies/||" | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
            TWEET_DIFF="${POLICY_NAMES:0:200}..."
            LAST_COMMIT_ID="${ALL_COMMITS[-1]}"
            
            # Build per-policy commit map JSON
            COMMIT_MAP_JSON="{"
            FIRST_ENTRY=true
            for key in "${!POLICY_COMMIT_MAP[@]}"; do
                if [ "$FIRST_ENTRY" = true ]; then
                    FIRST_ENTRY=false
                else
                    COMMIT_MAP_JSON+=","
                fi
                COMMIT_MAP_JSON+="\"$key\":\"${POLICY_COMMIT_MAP[$key]}\""
            done
            COMMIT_MAP_JSON+="}"

            # Format messages
            MESSAGE="{\"UpdatedPolicies\": \"$POLICY_NAMES\", \"CommitUrl\": \"https://github.com/zoph-io/IAMTrail/commit/$LAST_COMMIT_ID\", \"CommitMap\": $COMMIT_MAP_JSON, \"Date\": \"$DATE\", \"CommitCount\": \"${#ALL_COMMITS[@]}\"}"
            MESSAGE_BODY="$TWEET_DIFF https://github.com/zoph-io/IAMTrail/commit/$LAST_COMMIT_ID"

            # Send notifications
            send_notifications "$MESSAGE_BODY" "$MESSAGE"

            # Tag the run with a single summary tag
            git tag "${DATE}-update-${#ALL_COMMITS[@]}-policies"

            # Push commits first, then tags separately
            log "Pushing ${#ALL_COMMITS[@]} commits to master"
            git push origin master
            git push origin --tags

            discord_notify 3066993 "Policy Changes Pushed" "${#ALL_COMMITS[@]} policies updated and pushed to master" "Policies:${POLICY_NAMES:0:200}" "Commit:[View](https://github.com/zoph-io/IAMTrail/commit/$LAST_COMMIT_ID)"
        else
            log "No policy files were changed"
            discord_notify 3447003 "No Policy Changes" "Files changed but no policy updates detected"
        fi
    else
        log "No changes detected"
        discord_notify 3447003 "No Changes Detected" "All AWS managed policies are up to date"
    fi
}

####################
# Main Execution   #
####################

main() {
    log "Starting IAMTrail update process"
    discord_notify 3447003 "Runbook Started" "IAMTrail update process initiated"
    setup_git_auth
    clone_repo
    process_policies
    process_changes
    log "Job completed successfully"
    discord_notify 3066993 "Runbook Complete" "IAMTrail update process finished successfully"
}

main
