"""Readers for local agent transcripts, mirroring packages/readers.

Nothing here opens a socket, and nothing here writes to the file it reads.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..estimate import TokenCounts, UsageEvent

CLAUDE_CODE_SURFACE = "claude-code"
CODEX_SURFACE = "codex-cli"

# Token counts only started appearing in Codex rollouts on this date.
CODEX_TOKENS_FROM = "2025-09-06"


@dataclass
class ReaderResult:
    events: list[UsageEvent] = field(default_factory=list)
    warnings: list[dict[str, Any]] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    skipped: dict[str, int] = field(
        default_factory=lambda: {"synthetic": 0, "apiError": 0, "duplicate": 0, "noUsage": 0}
    )


def _read_jsonl(path: Path) -> Iterator[tuple[int, Any, str | None]]:
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for number, raw in enumerate(handle, start=1):
            text = raw.strip()
            if not text:
                continue
            try:
                yield number, json.loads(text), None
            except json.JSONDecodeError as cause:
                yield number, None, str(cause)


def _walk(root: Path, suffix: str = ".jsonl") -> list[Path]:
    if not root.exists():
        return []
    return sorted(p for p in root.rglob(f"*{suffix}") if p.is_file())


def _within(event: UsageEvent, since: str | None, until: str | None, session: str | None) -> bool:
    if since and event.timestamp < since:
        return False
    if until and event.timestamp > until:
        return False
    return not (session and event.session_id != session)


def _sort_events(events: list[UsageEvent]) -> list[UsageEvent]:
    return sorted(events, key=lambda event: (event.timestamp, event.id))


# ----------------------------------------------------------- Claude Code

# The provider writes this when it has nothing to report, and it is not a region.
_NOT_A_REGION = {"not_available", "unknown", ""}


def default_claude_dir() -> str:
    override = os.environ.get("BUAI_CLAUDE_DIR")
    if override:
        return override
    base = os.environ.get("CLAUDE_CONFIG_DIR") or str(Path.home() / ".claude")
    return str(Path(base) / "projects")


def _claude_event(line: dict[str, Any], file: str) -> UsageEvent:
    message = line.get("message") or {}
    usage = message.get("usage") or {}
    details = usage.get("output_tokens_details", "missing")

    # A null details object means the client wrote no thinking figure at all,
    # which is different from a model that cannot think. Pass None through so
    # the engine treats it as undisclosed rather than as none.
    if details is None:
        thinking: int | None | str = None
    elif details == "missing":
        thinking = None
    else:
        value = details.get("thinking_tokens")
        thinking = value if isinstance(value, int) else None

    server_tools = usage.get("server_tool_use") or {}
    tool_calls = sum(v or 0 for v in server_tools.values())

    geo = usage.get("inference_geo")
    region_hint = geo.upper() if geo and geo not in _NOT_A_REGION else None

    meta: dict[str, Any] = {"file": file}
    if tool_calls:
        meta["serverToolCalls"] = tool_calls
    if line.get("isSidechain"):
        meta["sidechain"] = True
    if line.get("cwd"):
        meta["project"] = line["cwd"]

    return UsageEvent(
        id=f"{message.get('id', 'unknown')}:{line.get('requestId', 'no-request')}",
        surface=CLAUDE_CODE_SURFACE,
        hosting="cloud",
        model_raw=message.get("model") or "",
        tokens=TokenCounts(
            input=usage.get("input_tokens") or 0,
            output=usage.get("output_tokens") or 0,
            cached_read=usage.get("cache_read_input_tokens") or 0,
            cached_write=usage.get("cache_creation_input_tokens") or 0,
            thinking=thinking,
            estimated=False,
            estimator="provider",
        ),
        timestamp=line.get("timestamp") or "",
        session_id=line.get("sessionId"),
        region_hint=region_hint,
        meta=meta,
    )


def read_claude_code(
    directory: str | None = None,
    since: str | None = None,
    until: str | None = None,
    session_id: str | None = None,
) -> ReaderResult:
    """Read Claude Code transcripts.

    A message appears once per content block, so the same message id and request
    id turn up several times with identical usage. On one real session, 76 of
    157 messages repeated; counting them all would have inflated the total by
    about half. We key on message id plus request id and keep the last copy.
    """
    root = Path(directory or default_claude_dir())
    result = ReaderResult()

    if not root.exists():
        result.warnings.append(
            {"file": str(root), "message": "No Claude Code transcripts here. Nothing to report."}
        )
        return result

    files = _walk(root)
    result.files = [str(p) for p in files]

    by_key: dict[str, UsageEvent] = {}

    for path in files:
        for number, value, error in _read_jsonl(path):
            if error:
                result.warnings.append(
                    {
                        "file": str(path),
                        "line": number,
                        "message": f"Could not parse this line, so it was skipped: {error}",
                    }
                )
                continue
            if not isinstance(value, dict) or value.get("type") != "assistant":
                continue

            message = value.get("message") or {}
            model = message.get("model")
            if model is None:
                result.skipped["noUsage"] += 1
                continue
            if model == "<synthetic>":
                result.skipped["synthetic"] += 1
                continue
            if value.get("isApiErrorMessage") is True:
                result.skipped["apiError"] += 1
                continue
            if not message.get("usage"):
                result.skipped["noUsage"] += 1
                continue

            key = f"{message.get('id', 'no-id')}:{value.get('requestId', 'no-request')}"
            if key in by_key:
                result.skipped["duplicate"] += 1
            by_key[key] = _claude_event(value, str(path))

    result.events = _sort_events(
        [e for e in by_key.values() if _within(e, since, until, session_id)]
    )
    return result


# ------------------------------------------------------------------ Codex


def default_codex_dir() -> str:
    return os.environ.get("CODEX_HOME") or str(Path.home() / ".codex")


_USAGE_KEYS = (
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
)


def _difference(current: dict[str, Any], previous: dict[str, Any]) -> dict[str, int]:
    # A replay can carry a smaller running total than the turn before it. That
    # is a reset, not a saving, so it contributes nothing rather than a negative.
    return {
        key: max(0, (current.get(key) or 0) - (previous.get(key) or 0)) for key in _USAGE_KEYS
    }


def _is_empty(usage: dict[str, Any]) -> bool:
    return (
        (usage.get("input_tokens") or 0) == 0
        and (usage.get("output_tokens") or 0) == 0
        and (usage.get("cached_input_tokens") or 0) == 0
        and (usage.get("cache_write_input_tokens") or 0) == 0
    )


def _codex_tokens(usage: dict[str, Any]) -> TokenCounts:
    cached_read = usage.get("cached_input_tokens") or 0
    reasoning = usage.get("reasoning_output_tokens") or 0
    # Both of these are subsets of the figure they sit inside, so they come out
    # of it rather than being added on top.
    return TokenCounts(
        input=max(0, (usage.get("input_tokens") or 0) - cached_read),
        output=max(0, (usage.get("output_tokens") or 0) - reasoning),
        cached_read=cached_read,
        cached_write=usage.get("cache_write_input_tokens") or 0,
        thinking=reasoning,
        estimated=False,
        estimator="provider",
    )


def read_codex_rollout(path: Path, result: ReaderResult) -> list[UsageEvent]:
    events: list[UsageEvent] = []
    session_id = path.name.removeprefix("rollout-").removesuffix(".jsonl")

    model: str | None = None
    previous_total: dict[str, Any] = {}
    turn = 0

    for number, value, error in _read_jsonl(path):
        if error:
            result.warnings.append(
                {
                    "file": str(path),
                    "line": number,
                    "message": f"Could not parse this line, so it was skipped: {error}",
                }
            )
            continue
        if not isinstance(value, dict):
            continue
        payload = value.get("payload")
        if not payload:
            continue

        # The model can change part way through, so it is tracked rather than
        # read once at the top.
        if value.get("type") == "turn_context" or payload.get("type") == "turn_context":
            if isinstance(payload.get("model"), str):
                model = payload["model"]
            continue

        if payload.get("type") != "token_count" and value.get("type") != "token_count":
            continue

        info = payload.get("info") or payload
        last = info.get("last_token_usage")
        total = info.get("total_token_usage")

        usage: dict[str, Any] | None = None
        basis = "per-turn"
        if last and not _is_empty(last):
            usage = last
        elif total:
            usage = _difference(total, previous_total)
            basis = "differenced"

        if total:
            previous_total = total
        if not usage or _is_empty(usage):
            result.skipped["noUsage"] += 1
            continue

        turn += 1
        events.append(
            UsageEvent(
                id=f"{session_id}:{turn}",
                surface=CODEX_SURFACE,
                hosting="cloud",
                model_raw=model or "",
                tokens=_codex_tokens(usage),
                timestamp=value.get("timestamp") or "",
                session_id=session_id,
                meta={"file": str(path), "basis": basis, "turn": turn},
            )
        )

    return events


def read_codex(
    directory: str | None = None,
    since: str | None = None,
    until: str | None = None,
    session_id: str | None = None,
) -> ReaderResult:
    home = Path(directory or default_codex_dir())
    result = ReaderResult()

    files: list[Path] = []
    for name in ("sessions", "archived_sessions"):
        files.extend(_walk(home / name))
    files.sort()

    if not files:
        result.warnings.append(
            {
                "file": str(home),
                "message": (
                    "No Codex CLI rollouts here. Note that rollouts written before "
                    "6 September 2025 carry no token counts at all."
                ),
            }
        )
        return result

    result.files = [str(p) for p in files]
    events: list[UsageEvent] = []
    for path in files:
        events.extend(read_codex_rollout(path, result))

    result.events = _sort_events([e for e in events if _within(e, since, until, session_id)])
    return result
