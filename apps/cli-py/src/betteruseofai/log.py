"""The event log: the history that outlives the transcripts.

Mirrors apps/cli-ts/src/log.ts line for line in behaviour, and byte for byte in
what it writes. One JSON object per line, keys sorted, no spaces, one file per
month, append only; the last line for an id wins when the log is read, and
prune compacts. Tokens are stored rather than figures so a dataset update
re-prices the whole history.

The location is shared with the TypeScript tool and the plugin's Stop hook on
purpose: under the Claude configuration directory, whichever tool is writing,
with BUAI_LOG_DIR as the override.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .estimate import TokenCounts, UsageEvent

LOG_VERSION = 1
LOG_WARN_BYTES = 200 * 1024 * 1024

_MONTH_FILE = re.compile(r"^\d{4}-\d{2}\.jsonl$")
_MONTH = re.compile(r"^\d{4}-\d{2}$")


def default_log_dir() -> str:
    override = os.environ.get("BUAI_LOG_DIR")
    if override:
        return override
    base = os.environ.get("CLAUDE_CONFIG_DIR") or str(Path.home() / ".claude")
    return str(Path(base) / "betteruseofai" / "log")


def default_out_dir(log_dir: str) -> str:
    """The dashboard file goes beside the log rather than in it."""
    return str(Path(log_dir).parent)


def to_line(event: UsageEvent, recorded: str) -> dict[str, Any]:
    tokens = event.tokens
    body: dict[str, Any] = {
        "input": tokens.input or 0,
        "output": tokens.output or 0,
        "cachedRead": tokens.cached_read or 0,
        "cachedWrite": tokens.cached_write or 0,
    }
    # A number is a count, None is undisclosed, and "absent" means the model
    # cannot think, which is written as no key at all.
    if tokens.thinking != "absent":
        body["thinking"] = tokens.thinking
    if tokens.tool:
        body["tool"] = tokens.tool
    if tokens.estimated:
        body["estimated"] = True
        body["estimator"] = tokens.estimator

    line: dict[str, Any] = {
        "v": LOG_VERSION,
        "id": event.id,
        "ts": event.timestamp,
        "recorded": recorded,
        "surface": event.surface,
        "hosting": event.hosting,
        "model": event.model_raw,
        "tokens": body,
    }
    if event.session_id:
        line["session"] = event.session_id
    if event.region_hint:
        line["region"] = event.region_hint
    project = event.meta.get("project")
    if isinstance(project, str) and project:
        line["project"] = project
    branch = event.meta.get("branch")
    if isinstance(branch, str) and branch:
        line["branch"] = branch
    return line


def serialise(line: dict[str, Any]) -> str:
    return json.dumps(line, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def from_line(line: dict[str, Any], file: str) -> UsageEvent:
    body = line["tokens"]
    tokens = TokenCounts(
        input=body.get("input", 0),
        output=body.get("output", 0),
        cached_read=body.get("cachedRead", 0),
        cached_write=body.get("cachedWrite", 0),
        thinking=body.get("thinking", "absent"),
        tool=body.get("tool", 0),
        estimated=body.get("estimated") is True,
        estimator=body.get("estimator", "provider"),
    )
    meta: dict[str, Any] = {"file": file, "fromLog": True}
    if line.get("project"):
        meta["project"] = line["project"]
    if line.get("branch"):
        meta["branch"] = line["branch"]
    return UsageEvent(
        id=line["id"],
        surface=line["surface"],
        hosting=line["hosting"],
        model_raw=line["model"],
        tokens=tokens,
        timestamp=line["ts"],
        session_id=line.get("session"),
        region_hint=line.get("region"),
        meta=meta,
    )


def _is_line(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and value.get("v") == LOG_VERSION
        and isinstance(value.get("id"), str)
        and isinstance(value.get("ts"), str)
        and isinstance(value.get("tokens"), dict)
    )


def _month_files(directory: str) -> list[Path]:
    root = Path(directory)
    if not root.exists():
        return []
    return sorted(p for p in root.iterdir() if p.is_file() and _MONTH_FILE.match(p.name))


@dataclass
class LogRead:
    events: list[UsageEvent]
    duplicates: int
    skipped: int
    files: int
    bytes: int


def read_log(directory: str) -> LogRead:
    by_id: dict[str, UsageEvent] = {}
    duplicates = 0
    skipped = 0
    size = 0
    files = _month_files(directory)
    for file in files:
        text = file.read_text(encoding="utf-8")
        size += len(text.encode("utf-8"))
        for raw in text.split("\n"):
            trimmed = raw.strip()
            if not trimmed:
                continue
            try:
                value = json.loads(trimmed)
            except json.JSONDecodeError:
                skipped += 1
                continue
            if not _is_line(value):
                skipped += 1
                continue
            if value["id"] in by_id:
                duplicates += 1
            by_id[value["id"]] = from_line(value, str(file))
    events = sorted(by_id.values(), key=lambda event: (event.timestamp, event.id))
    return LogRead(events, duplicates, skipped, len(files), size)


def append_log(directory: str, events: list[UsageEvent], recorded: str) -> int:
    if not events:
        return 0
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    by_month: dict[str, list[str]] = {}
    for event in events:
        month = event.timestamp[:7]
        if not _MONTH.match(month):
            continue
        by_month.setdefault(month, []).append(serialise(to_line(event, recorded)))
    written = 0
    for month in sorted(by_month):
        lines = by_month[month]
        with (root / f"{month}.jsonl").open("a", encoding="utf-8", newline="\n") as handle:
            handle.write("\n".join(lines) + "\n")
        written += len(lines)
    return written


def log_size(directory: str) -> tuple[int, int]:
    files = _month_files(directory)
    return len(files), sum(f.stat().st_size for f in files)


@dataclass
class PruneResult:
    removed: int
    duplicates: int
    kept: int
    files_before: int
    files_after: int
    bytes_before: int
    bytes_after: int


def prune_log(directory: str, before: str | None, dry_run: bool) -> PruneResult:
    files = _month_files(directory)
    cutoff = before or ""
    removed = 0
    duplicates = 0
    kept = 0
    bytes_before = 0
    bytes_after = 0
    files_after = 0

    for file in files:
        text = file.read_text(encoding="utf-8")
        bytes_before += len(text.encode("utf-8"))
        last: dict[str, dict[str, Any]] = {}
        for raw in text.split("\n"):
            trimmed = raw.strip()
            if not trimmed:
                continue
            try:
                value = json.loads(trimmed)
            except json.JSONDecodeError:
                continue
            if not _is_line(value):
                continue
            if value["id"] in last:
                duplicates += 1
            last[value["id"]] = value
        survivors = []
        for line in last.values():
            if cutoff == "" or line["ts"] >= cutoff:
                survivors.append(line)
            else:
                removed += 1
        kept += len(survivors)
        if survivors:
            out = "\n".join(serialise(line) for line in survivors) + "\n"
            bytes_after += len(out.encode("utf-8"))
            files_after += 1
            if not dry_run:
                file.write_text(out, encoding="utf-8", newline="\n")
        elif not dry_run:
            file.unlink()

    return PruneResult(
        removed, duplicates, kept, len(files), files_after, bytes_before, bytes_after
    )
