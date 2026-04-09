# pathfinding.cloud catalog (vendored snapshot)

This directory holds a JSON export of [pathfinding.cloud](https://pathfinding.cloud/paths/) privilege escalation paths, used by `website/scripts/generate-data.js` to flag AWS managed policies whose **Allow** actions cover each path’s `permissions.required` set (action-level overlap only; not account-specific exploitability).

## License

The path data is from [DataDog/pathfinding.cloud](https://github.com/DataDog/pathfinding.cloud) (Apache License 2.0). See [About](https://iamtrail.com/about) for attribution.

## Updating the snapshot

Refresh `paths.json` from the official site (same file their UI loads):

```bash
curl -fsSL "https://pathfinding.cloud/paths.json" -o data/pathfinding/paths.json
```

Commit the updated file when you want IAMTrail builds to track a newer catalog.
