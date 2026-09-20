# betteruseofai

See the energy, water and carbon behind your own agent sessions. Everything is worked out on your
machine. There is no backend, no account and no telemetry.

```
uvx betteruseofai summary --since 7d
```

This is the Python half of a pair. It and the npm package `betteruseofai` produce byte for byte
identical JSON from the same logs, checked in CI on Linux, macOS and Windows. If they ever disagree,
that is a bug in one of them, and the parity job says so.

```
uvx betteruseofai dashboard
```

writes every session on this machine as one page, fonts and data inside it, and opens it. Nothing
in the file is fetched from anywhere. Add `--with-projects` to put directory and branch names on it;
they are left out otherwise.

Both tools keep an event log at `~/.claude/betteruseofai/log`, one JSON line per turn with the
model and the token counts, so the history outlives Claude Code's own transcript retention. The log
is append only and shared between the two tools and the Claude Code plugin. `betteruseofai prune
--before 365d` trims it.

See the repository for the method, the sources behind every number, and what we do not know.
