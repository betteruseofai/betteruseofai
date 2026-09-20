---
"betteruseofai": minor
"@betteruseofai/core": minor
"@betteruseofai/tokens": minor
"@betteruseofai/readers": minor
---

An event log that outlives the transcripts, and a dashboard across sessions.

Every run of the command line tool, and the Claude Code plugin's Stop hook, appends each turn it
reads to an append-only log under the Claude configuration directory: one JSON line per turn, the
model and the token counts and nothing else. `betteruseofai dashboard` writes every session on the
machine as one HTML file with its fonts and its data inside, and opens it. `betteruseofai prune --before`
trims the log. The Python package does the same and writes the identical file. Directory and branch
names are left out of the dashboard unless `--with-projects` is given. The saving against the
largest model in each family now lives in core, and the readers record the git branch a turn was
made on.
