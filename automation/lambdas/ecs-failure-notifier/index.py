import json
import traceback
import discord_notifier as discord


def handler(event, context):
    """Handle EventBridge ECS Task State Change events and notify Discord."""
    print(json.dumps(event))

    try:
        detail = event.get("detail", {})
        task_arn = detail.get("taskArn", "unknown")
        task_id = task_arn.rsplit("/", 1)[-1] if "/" in task_arn else task_arn
        stop_code = detail.get("stopCode", "unknown")
        stopped_reason = detail.get("stoppedReason", "No reason provided")

        containers = detail.get("containers", [])

        if stop_code == "EssentialContainerExited":
            exit_codes = [c.get("exitCode") for c in containers]
            if exit_codes and all(code == 0 for code in exit_codes):
                print(f"Task {task_id} exited cleanly (all containers exit code 0), skipping alert")
                return {"statusCode": 200}

        container_info = []
        for c in containers:
            name = c.get("name", "?")
            exit_code = c.get("exitCode", "N/A")
            reason = c.get("reason", "")
            line = f"`{name}` - exit code: **{exit_code}**"
            if reason:
                line += f" ({reason})"
            container_info.append(line)

        cluster_arn = detail.get("clusterArn", "")
        cluster_name = cluster_arn.rsplit("/", 1)[-1] if "/" in cluster_arn else cluster_arn

        fields = [
            ("Stop Code", stop_code, True),
            ("Cluster", cluster_name, True),
            ("Task ID", f"`{task_id}`", False),
        ]
        if container_info:
            fields.append(("Containers", "\n".join(container_info), False))

        discord.send(
            "ECS Task Failed",
            stopped_reason[:1000],
            discord.COLOR_ERROR,
            fields=fields,
            footer="ECS Monitoring",
        )

    except Exception as e:
        print(f"Error processing event: {e}")
        print(traceback.format_exc())
        discord.send(
            "ECS Failure Notifier Error",
            f"```{traceback.format_exc()[-500:]}```",
            discord.COLOR_ERROR,
        )

    return {"statusCode": 200}
