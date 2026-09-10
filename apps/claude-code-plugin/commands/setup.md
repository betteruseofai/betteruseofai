---
description: Put the footprint on your status line
allowed-tools: Read, Edit, Write, Bash
---

# Set up the status line

A plugin cannot set `statusLine` itself. Only user or project settings can, so this command writes
the entry for you, with the user's say-so first.

Do this:

1. Work out the plugin root. It is the directory holding `dist/betteruseofai.mjs`, and the shim
   sits beside it at `<root>/dist/statusline.mjs`. Use `${CLAUDE_PLUGIN_ROOT}` if it is set in the
   environment, or look for `betteruseofai/dist/betteruseofai.mjs` under the Claude Code plugins
   directory.

2. Read `~/.claude/settings.json`. Treat a missing file as `{}`.

3. Tell the user exactly what you are about to add, and what it does:

   - it reads a small text file and prints one line, about 48 milliseconds on the machine this
     was written on
   - it loads no dataset and parses no transcript, because the line is already rendered by the
     Stop hook, which is running anyway
   - nothing contacts a network

   If they already have a `statusLine`, say so and ask whether to replace it. Never overwrite one
   without asking.

4. On their agreement, set `statusLine` to this, with the absolute path written out, because
   `settings.json` does not expand `${CLAUDE_PLUGIN_ROOT}`:

   ```json
   {
     "type": "command",
     "command": "node \"<root>/dist/statusline.mjs\"",
     "padding": 0
   }
   ```

   The same command works on every platform. A shell script was tried first, on the assumption
   that avoiding Node would be faster; measurement showed the opposite, by a factor of three.

5. Tell them the line stays empty until the first Stop hook has run, which is after their next
   turn. That is expected, not a fault.

## If they would rather not edit settings

Say so plainly. They can run `betteruseofai session` in a terminal for the same figures whenever
they want them, and the hooks still report the session total every ten turns with no status line at
all.
