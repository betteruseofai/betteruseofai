# Better Use of AI, for Claude Code

A live footprint on your status line, a session total every ten turns, and a nudge when a smaller
model would probably do. Everything is worked out on your machine. Nothing is sent anywhere.

## Installing

```
/plugin marketplace add betteruseofai/betteruseofai
/plugin install betteruseofai
/betteruseofai:setup
```

The setup command exists because a plugin cannot set `statusLine` itself. Only user or project
settings can, so the command asks first and then writes the entry for you. Say no and the rest still
works: the hooks report the session total without any status line at all.

## What it adds

| Piece | What it does |
|---|---|
| Status line | `4.10 kWh · 13.4 L · 1.82 kg · Claude Opus 5 100% · ctx 41%` |
| `Stop` hook | Keeps the running total, and says it every ten turns |
| `UserPromptSubmit` hook | Nudges when a smaller model would do, on a high bar |
| `/betteruseofai:report` | What this session has cost, with its heaviest turns |
| `/betteruseofai:footprint` | What the last week has cost |
| `/betteruseofai:mute` | Turn off one nudge without turning off the rest |

## The status line is cheap on purpose

The line is rendered by the `Stop` hook, which is running anyway, and written to a small text file.
The status line command reads that file and prints it, loading no dataset and parsing no transcript.

That design came out of a measurement, not a guess. The first attempt was a shell script, on the
assumption that avoiding Node would be faster. Against a 77 ms harness baseline on the machine this
was written on:

| Approach | Cost |
|---|---|
| Node, reading the cached line | 48 ms |
| Node, the full tool with `--cheap` | 47 ms |
| `sh` with `sed` and `tr` | 133 ms |
| PowerShell 5.1 | 274 ms |

Git Bash and PowerShell both start slower than Node, so the shell shims were deleted rather than
kept as a fallback nobody would want.

## The nudge is quiet by default

Inside a coding session the bar is higher than elsewhere, and three rules are muted outright:

- `no-llm.arithmetic`, because a sum on a line is usually being discussed rather than asked
- `no-llm.unit-conversion`, for the same reason
- `downgrade.short-simple`, because a one-line follow-up only makes sense with the whole session
  behind it

A nudge that fires wrongly gets the whole feature switched off, and then nothing is measured at all.
Every nudge names the rule that produced it, so you can mute that one rule with
`/betteruseofai:mute`.

## What the figures mean

Every figure is a range, because the published measurements disagree by an order of magnitude,
mostly over where the system boundary is drawn. An unrecognised model reads "unknown", never zero. A
model that hid its reasoning tokens gives a lower bound rather than a total.

The `betteruseofai-methodology` skill has the full account, including what we do not know.

## Requirements

Node 20 or newer, which Claude Code already needs. Nothing else, and no network.
