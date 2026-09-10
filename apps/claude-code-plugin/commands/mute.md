---
description: Stop a particular nudge
allowed-tools: Read, Edit, Write
---

# Mute a nudge

The recommender fires on rules, each with an id such as `downgrade.rewrite-task`. If one of them is
wrong for the way you work, turn that one off rather than the whole thing.

1. Ask which rule, or read the id out of the last nudge they saw. Every nudge names its rule.
2. Read `~/.claude/betteruseofai/config.json`, treating a missing file as `{}`.
3. Add the id to a `muted` array and write the file back.
4. Confirm what is now muted, and say that `betteruseofai recommend "<some prompt>"` will show what
   the recommender would say without waiting for a real nudge.

If they want no nudges at all, the honest answer is to remove the `UserPromptSubmit` hook from the
plugin rather than muting rule by rule. Say that. The status line and the session report carry on
working without it.
