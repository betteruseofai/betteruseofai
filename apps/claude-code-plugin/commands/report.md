---
description: What this session has cost so far
allowed-tools: Bash
---

# Session report

Run the bundled tool against this session and show the result.

```
node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" session "${CLAUDE_SESSION_ID}" --no-color
```

Claude Code writes this session's id into the command above before you see it, so it is always
this session, even when several are open. It is not an environment variable, which is why the
braces matter. If the id did not come through and the command says there is no such session, run
`node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" sessions`, show the list, and ask which one
they mean rather than picking the most recent: with two sessions open, the most recent is often
the other one.

Show the output as it comes. Do not summarise it, and do not round the numbers further: the ranges
and the caveats are the point. If the report says the figures are a lower bound, or that a model was
scaled from a different one, leave that in.
