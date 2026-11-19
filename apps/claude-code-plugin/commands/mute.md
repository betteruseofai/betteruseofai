---
description: Stop a particular nudge
allowed-tools: Read, Edit, Write
---

# Mute a nudge

The plugin says two things about a session, each once, and each names its rule:
`session.long-context` for a turn that read a very large context, and `session.top-model` for a
long session on the biggest model of its family. If one of them is no use to the way you work, turn
that one off rather than the whole plugin.

1. Ask which rule, or read the id out of the last message they saw.
2. Read `~/.claude/betteruseofai/config.json`, treating a missing file as `{}`. If
   `CLAUDE_CONFIG_DIR` is set, the file is under that directory instead of `~/.claude`.
3. Add the id to a `muted` array, keep anything else in the file as it was, and write it back. The
   `Stop` hook reads this file after every turn, so the mute takes effect from the next one.
4. Confirm what is now muted.

Muting both leaves the status line, the total every ten turns and the session report as they were.
