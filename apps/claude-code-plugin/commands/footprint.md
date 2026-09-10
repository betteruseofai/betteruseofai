---
description: What your recent sessions have cost
allowed-tools: Bash
---

# Footprint

Show what the last week has cost across every session.

```
node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" summary --since 7d --no-color
```

If the user names a window, a region or a grouping, pass it through: `--since 30d`, `--region GB`,
`--by model`, `--by session`.

Show the output as it comes, including the line about turns that could not be priced. A total that
silently leaves out a third of the turns is worse than no total.
