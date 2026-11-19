# Better Use of AI, for Claude Code

A live footprint on your status line, a session total every ten turns, and a word when the session
itself is the heavy part: a very large context, or a long run on the biggest model. Everything is
worked out on your machine. Nothing is sent anywhere.

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
| `Stop` hook | Keeps the running total, says it every ten turns, appends each turn to the event log, and says each session message once |
| `/betteruseofai:report` | What this session has cost, with its heaviest turns |
| `/betteruseofai:footprint` | What the last week has cost |
| `/betteruseofai:mute` | Turn off one session message without turning off the other |
| `/betteruseofai:dashboard` | Every session on this machine as one page, written to a file and opened |

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

## The log outlives the transcripts

Claude Code deletes its transcripts after a while, thirty days by default, and everything the tool
shows is worked out from those files. So the `Stop` hook also appends each turn it reads to a log
of its own at `~/.claude/betteruseofai/log`, one JSON line per turn, one file per month, holding
the model and the token counts and nothing else. No prompt text, no figures. The figures are worked
out when the log is read back, which means a dataset update re-prices the whole history rather than
leaving old numbers behind.

The log is append only and grows slowly, a few hundred bytes a turn. `betteruseofai prune --before
365d` trims it; nothing trims it on its own. `betteruseofai doctor` says how big it is. It never
leaves the machine.

## What we say about a session

We used to read each prompt before it went and suggest a smaller model when it looked simple. In an
agent that guess doesn't work. A short prompt such as "carry on" points at a long task and a lot of
context, so its length says nothing about the work. Measured on 240 real prompts, the hint either
almost never fired or fired wrongly on a quarter of them.

What does move the number shows up after a turn has run. Each turn re-reads the whole context, and
turns over 150,000 tokens held three quarters of the energy in the sessions we measured. The model
the session runs on is the other big lever. So the `Stop` hook says two things, each at most once a
session and never both on the same turn:

- `session.long-context`, when a turn reads more than 150,000 tokens of context. It says how much
  of the session's energy is on turns that size. Re-reading cached context is the least certain
  part of our estimate, and the message says so.
- `session.top-model`, after 30 priced turns of which four in five ran on a model with a smaller
  sibling. It says what the same turns would have used one rung down, from their real token counts,
  for your region and water scope.

Every message names its rule, so you can turn either one off with `/betteruseofai:mute`.

## What the figures mean

Every figure is a range, because the published measurements disagree by an order of magnitude,
mostly over where the system boundary is drawn. An unrecognised model reads "unknown", never zero,
and a total that leaves it out is marked as a lower bound.

The `betteruseofai-methodology` skill has the full account, including what we do not know.

## Requirements

Node 22 or newer, the oldest we test on. Nothing else, and no network.
