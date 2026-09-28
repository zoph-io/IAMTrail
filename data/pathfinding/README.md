# pathfinding.cloud catalog (vendored snapshot)

This directory holds a JSON export of [pathfinding.cloud](https://pathfinding.cloud/paths/) privilege escalation paths, used by the risk assessment in `website/scripts/policy-risk.js` to flag AWS managed policies whose effective **Allow** grants cover each path's `permissions.required` set. Wildcards and `NotAction` are expanded, an unconditional Deny cancels a grant, and each path is marked unrestricted (every resource, no condition) or scoped. It reads the policy document only, not account-specific exploitability. The website build fails if this file is missing or empty.

## License

The path data is from [DataDog/pathfinding.cloud](https://github.com/DataDog/pathfinding.cloud) (Apache License 2.0). See [About](https://iamtrail.com/about) for attribution.

## Updating the snapshot

The daily `[Prod] IAMTrail - Data Freshness` workflow (`.github/workflows/data-freshness.yml`) downloads `paths.json` from the official site (the same file their UI loads), commits it when it moved and triggers a website deployment. A failed refresh alerts the ops channel.
