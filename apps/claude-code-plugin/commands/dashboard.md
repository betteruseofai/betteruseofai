---
description: Every session on this machine, as one page
allowed-tools: Bash
---

# The dashboard

Write the dashboard and open it.

```
node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" dashboard --no-color
```

It prints where the file went and how many turns and sessions it covers. Show that as it comes. If
the person asks for their project or branch names on the page, add `--with-projects`; they are left
out otherwise, on purpose, because the page is the sort of thing that gets screenshotted.

The page reads the event log the Stop hook has been writing as well as whatever transcripts are
still on disk, so it reaches further back than Claude Code's own retention. If it says some turns
are known only from the log, that is the log doing its job, not a fault.

If the file did not open on its own, give the path so they can open it by hand. Nothing in the file
is fetched from anywhere and nothing about it leaves the machine.
