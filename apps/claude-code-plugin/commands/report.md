---
description: What this session has cost so far
allowed-tools: Bash
---

# Session report

Run the bundled tool against this session and show the result.

```
node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" session "$CLAUDE_SESSION_ID" --no-color
```

If `CLAUDE_SESSION_ID` is not set, run `node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" sessions`
first and use the most recent one.

Show the output as it comes. Do not summarise it, and do not round the numbers further: the ranges
and the caveats are the point. If the report says the figures are a lower bound, or that a model was
scaled from a different one, leave that in.
