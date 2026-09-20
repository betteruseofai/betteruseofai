# Log fixtures

Synthetic transcripts, written by hand to carry every trap the real formats contain. No real prompt
text, no real session identifiers, nothing taken off anyone's machine. CI never reads a real home
directory and never contacts a provider.

The TypeScript readers and the Python ones are both run against these files, and the parity check
compares the two outputs byte for byte.

## What each file is for

### `claude-code/projects/example-project/session-alpha.jsonl`

| Line | What it tests |
|---|---|
| A user line | Must be ignored, not counted as a turn with no model |
| `msg_002` three times | The same message appears once per content block with identical usage. Counting all three inflates this session by two thirds. On one real session here, 76 of 157 messages repeated |
| `<synthetic>` | Written by the client, not by a model, with every count at zero. Must not show up as an unrecognised model |
| `isApiErrorMessage` | A turn that failed |
| Null details object | The model thinks and the count was never written, which is not the same as thinking nothing |
| Explicit null count | The same thing said a different way |
| `inference_geo: "us"` | A real region, as against the `not_available` sentinel that must not become one |
| `claude-opus-42` | A model we do not know. It has to survive as an unknown rather than being dropped or guessed at |
| A broken line | The rest of the file still has to be read |
| Null usage | A turn with nothing to count |

### `claude-code/projects/example-project/session-beta.jsonl`

A second session, so grouping by session can be tested, with a cache-heavy turn and a subagent turn.
Subagent turns count: they burn the same energy as any other.

### `codex/sessions/2026/09/01/rollout-one.jsonl`

Per-turn figures present, which is the path we prefer, and a model that changes half way through.

### `codex/sessions/2026/09/01/rollout-two.jsonl`

No per-turn figures anywhere, so every turn has to be differenced against the running total. The
third entry has a **lower** total than the one before it, which is what a subagent replay looks like
when it inherits its parent's snapshot. Differencing has to yield nothing there rather than a
negative.

### `codex/archived_sessions/rollout-old.jsonl`

Archived rollouts are read too.

### `buai-log/2026-08.jsonl`

The event log, as both tools write it: three lines for two turns. The second turn appears twice,
the later line with a different output count and no branch, and the reader has to keep the later
one. The parity harness gives each tool a fresh copy of this directory through `BUAI_LOG_DIR` for
every case, so the log is read and written on every run, and pruned where a case asks, with the
results compared like everything else.
