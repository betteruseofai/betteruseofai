---
description: Stop a particular nudge
allowed-tools: Read, Edit, Write
---

# Mute a nudge

The recommender fires on rules, each with an id such as `downgrade.rewrite-task`. If one of them is
wrong for the way you work, turn that one off rather than the whole thing.

1. Ask which rule, or read the id out of the last nudge they saw. Every nudge names its rule.
2. Read `~/.claude/betteruseofai/config.json`, treating a missing file as `{}`. If
   `CLAUDE_CONFIG_DIR` is set, the file is under that directory instead of `~/.claude`.
3. Add the id to a `muted` array, keep anything else in the file as it was, and write it back. The
   hook reads this file on every prompt, so the mute takes effect from the next one.
4. Confirm what is now muted, and say that
   `node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" recommend "<some prompt>"` shows what the
   recommender would say without waiting for a real nudge. That command does not read the mutes,
   so it still shows a muted rule firing.

If they want no nudges at all, the honest answer is to remove the `UserPromptSubmit` hook from the
plugin rather than muting rule by rule. Say that. The status line and the session report carry on
working without it.
