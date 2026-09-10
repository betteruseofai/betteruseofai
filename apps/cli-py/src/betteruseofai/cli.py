"""The command line tool, mirroring apps/cli-ts.

The JSON is the contract: both tools produce the same bytes from the same logs,
and the parity job fails on any difference. The plain text output is for a
person and does not have to match, though it says the same things in the same
words.
"""

from __future__ import annotations

import math
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .aggregate import Aggregate, aggregate, equivalents
from .canonical import SCHEMA_VERSION, canonical_json, canonical_number
from .engine import Range, downgrade_target, get_model, load_dataset, select_benchmark
from .estimate import Estimate, UsageEvent, estimate
from .readers import default_claude_dir, default_codex_dir, read_claude_code, read_codex

VERSION = "0.0.0"

VALUE_FLAGS = {
    "since", "until", "by", "region", "format", "source", "dir", "now",
    "water-scope", "carbon-basis", "limit", "interval",
}  # fmt: skip
SWITCH_FLAGS = {"json", "no-color", "help", "version", "ascii", "cheap", "all", "verbose"}

WATER_SCOPES = ("on-site", "on-site + off-site", "lifecycle")
BUCKETS = ("day", "week", "model", "surface", "session", "hosting", "all")

USAGE = """betteruseofai

  See the energy, water and carbon behind your own agent sessions. Everything is
  worked out on this machine. Nothing is sent anywhere.

USAGE
  betteruseofai <command> [options]

COMMANDS
  summary          What your sessions cost, grouped by day, week, model or session
  sessions         Every session, with its total
  session <id>     The report for one session, including its heaviest turns
  export           Every turn as a row, for a spreadsheet
  models           Which models we know, what measures them, and how good that measure is
  doctor           Check the things that go wrong, and say what to do about each

OPTIONS
  --since <when>          7d, 24h, 2w, or an ISO timestamp
  --until <when>          An ISO timestamp
  --by <bucket>           day, week, model, surface, session, hosting or all
  --source <names>        claude-code, codex, or both separated by a comma
  --dir <path>            Read transcripts from here instead of the usual place
  --region <code>         Grid to price the carbon against. Run "models --all" for the list
  --water-scope <scope>   on-site, "on-site + off-site" (the default), or lifecycle
  --carbon-basis <basis>  location-based (the default) or provider-reported
  --format <format>       table, json or csv, depending on the command
  --json                  Same as --format json
  --now <iso>             Pretend it is this moment, so a fixture run is repeatable
  --ascii                 Avoid characters a plain terminal cannot draw
  --no-color              No escape codes
  --all                   Show the regions as well, on the models command
  -h, --help              This text
  -v, --version           The version and the dataset it ships with

A NOTE ON THE FIGURES
  Every figure is a range, because the published measurements of AI energy use
  disagree by an order of magnitude. Where we do not know something we say so: an
  unrecognised model reads "unknown", and a model that hid its reasoning tokens
  gives a lower bound rather than a total."""


# ------------------------------------------------------------------ parsing


def parse_args(argv: list[str]) -> dict[str, Any]:
    flags: dict[str, Any] = {}
    positional: list[str] = []
    errors: list[str] = []

    index = 0
    while index < len(argv):
        token = argv[index]
        index += 1

        if token == "--":
            positional.extend(argv[index:])
            break

        if token.startswith("--"):
            body = token[2:]
            name, _, inline = body.partition("=")
            has_inline = "=" in body

            if name in VALUE_FLAGS:
                if has_inline:
                    flags[name] = inline
                elif index < len(argv) and not argv[index].startswith("--"):
                    flags[name] = argv[index]
                    index += 1
                else:
                    errors.append(f"--{name} needs a value.")
            elif name in SWITCH_FLAGS:
                if has_inline:
                    errors.append(f"--{name} does not take a value.")
                flags[name] = True
            else:
                errors.append(f"No such option: --{name}")
            continue

        if token == "-h":
            flags["help"] = True
            continue
        if token == "-v":
            flags["version"] = True
            continue

        positional.append(token)

    command = positional.pop(0) if positional else ""
    return {"command": command, "positional": positional, "flags": flags, "errors": errors}


_RELATIVE = re.compile(r"^(\d+)([dhwm])$")


def resolve_since(value: str | None, now: datetime) -> str | None:
    if not value:
        return None
    match = _RELATIVE.match(value.strip())
    if not match:
        return value
    amount = int(match.group(1))
    unit = match.group(2)
    hours = {"h": amount, "d": amount * 24, "w": amount * 168, "m": amount * 720}[unit]
    stamp = now - timedelta(hours=hours)
    return stamp.strftime("%Y-%m-%dT%H:%M:%S.") + f"{stamp.microsecond // 1000:03d}Z"


# ------------------------------------------------------------------ context


class Context:
    def __init__(self, args: dict[str, Any]) -> None:
        self.errors: list[str] = []
        flags = args["flags"]

        now_flag = flags.get("now")
        if now_flag:
            try:
                self.now = datetime.fromisoformat(str(now_flag).replace("Z", "+00:00"))
            except ValueError:
                self.errors.append(f"--now is not a date I can read: {now_flag}")
                self.now = datetime.now(timezone.utc)
        else:
            self.now = datetime.now(timezone.utc)

        scope = flags.get("water-scope")
        if scope and scope not in WATER_SCOPES:
            self.errors.append(f"--water-scope must be one of: {', '.join(WATER_SCOPES)}")
        self.water_scope = scope or "on-site + off-site"

        basis = flags.get("carbon-basis")
        if basis and basis not in ("location-based", "provider-reported"):
            self.errors.append("--carbon-basis must be location-based or provider-reported.")
        self.carbon_basis = basis or "location-based"

        requested = flags.get("source")
        self.sources = (
            [s.strip() for s in str(requested).split(",")]
            if requested
            else ["claude-code", "codex"]
        )
        for source in self.sources:
            if source not in ("claude-code", "codex"):
                self.errors.append(
                    "--source must be claude-code or codex, or both separated by a comma. "
                    f"Got: {source}"
                )

        dataset_path = flags.get("dataset")
        self.dataset = load_dataset(dataset_path)

        self.region_code = flags.get("region")
        if self.region_code and not any(
            r["code"] == self.region_code for r in self.dataset["regions"]
        ):
            self.errors.append(
                f'We have no grid figures for the region "{self.region_code}". '
                'Run "betteruseofai models --all" to see the list.'
            )

        self.since = resolve_since(flags.get("since"), self.now)
        self.until = flags.get("until")
        self.json = bool(flags.get("json")) or flags.get("format") == "json"
        self.colour = not flags.get("no-color") and sys.stdout.isatty()
        self.ascii = bool(flags.get("ascii"))
        self.dir = flags.get("dir")

    def iso_now(self) -> str:
        stamp = self.now.astimezone(timezone.utc)
        return stamp.strftime("%Y-%m-%dT%H:%M:%S.") + f"{stamp.microsecond // 1000:03d}Z"


def load_events(context: Context) -> list[tuple[UsageEvent, Estimate]]:
    events: list[UsageEvent] = []
    results = []

    if "claude-code" in context.sources:
        directory = str(Path(context.dir) / "projects") if context.dir else None
        results.append(read_claude_code(directory, context.since, context.until))
    if "codex" in context.sources:
        results.append(read_codex(context.dir, context.since, context.until))

    for result in results:
        events.extend(result.events)
    events.sort(key=lambda event: (event.timestamp, event.id))

    context.reader_results = results  # type: ignore[attr-defined]

    return [
        (
            event,
            estimate(
                event,
                context.dataset,
                region_code=context.region_code,
                water_scope=context.water_scope,
                carbon_basis=context.carbon_basis,
            ),
        )
        for event in events
    ]


# ------------------------------------------------------------------- output


def range_out(value: Range | None) -> dict[str, str] | None:
    if value is None:
        return None
    return {
        "low": canonical_number(value.low),
        "central": canonical_number(value.central),
        "high": canonical_number(value.high),
    }


def payload(context: Context, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "header": {
            "schemaVersion": SCHEMA_VERSION,
            "datasetVersion": context.dataset["version"],
            "datasetSha256": context.dataset["sha256"],
            "generatedWith": "betteruseofai python",
            "generatedAt": context.iso_now(),
        },
        **body,
    }


def emit_json(context: Context, body: dict[str, Any]) -> str:
    return canonical_json(payload(context, body)).rstrip("\n")


_ANSI = {"dim": "\x1b[2m", "bold": "\x1b[1m", "green": "\x1b[32m", "yellow": "\x1b[33m"}


def paint(context: Context, colour: str, text: str) -> str:
    return f"{_ANSI[colour]}{text}\x1b[0m" if context.colour else text


def display_number(value: float) -> str:
    """Match what the TypeScript tool prints, digit for digit.

    The last branch cannot use %g. Python switches to exponent notation at
    1e-5, and JavaScript's toPrecision waits until 1e-7, so 0.0000012 would come
    out as 1.2e-06 here and 0.0000012 there. The two tools would then disagree
    in their plain text even while their JSON matched.
    """
    magnitude = abs(value)
    if magnitude == 0:
        return "0"
    if magnitude >= 100:
        return str(round(value))
    if magnitude >= 10:
        return f"{value:.1f}"
    if magnitude >= 1:
        return f"{value:.2f}"
    if magnitude >= 0.01:
        return f"{value:.3f}"
    exponent = math.floor(math.log10(magnitude))
    if exponent >= -7:
        return f"{value:.{1 - exponent}f}"
    mantissa = f"{value:.1e}"
    base, _, power = mantissa.partition("e")
    return f"{base}e{power[0]}{power[1:].lstrip('0') or '0'}"


def format_range(
    value: Range | None,
    unit: str = "",
    flags: list[str] | None = None,
    bounds: bool = True,
    ascii_only: bool = False,
) -> str:
    if value is None:
        return "unknown"
    flags = flags or []
    suffix = f" {unit}" if unit else ""
    lower_bound = "thinking-unknown" in flags
    estimated = "tokens-estimated" in flags or "derived-rate" in flags
    prefix = (">= " if ascii_only else "≥ ") if lower_bound else ("~" if estimated else "")
    central = f"{prefix}{display_number(value.central)}{suffix}"
    if not bounds:
        return central
    return f"{central} [ {display_number(value.low)} to {display_number(value.high)} ]"


def table(
    context: Context,
    headers: list[str],
    rows: list[list[str]],
    align: list[str] | None = None,
) -> str:
    align = align or []
    widths = [
        max(len(header), *(len(row[column]) for row in rows)) if rows else len(header)
        for column, header in enumerate(headers)
    ]

    def pad(text: str, column: int) -> str:
        return (
            text.rjust(widths[column])
            if column < len(align) and align[column] == "right"
            else text.ljust(widths[column])
        )

    lines = [
        paint(context, "dim", "  ".join(pad(h.upper(), c) for c, h in enumerate(headers))),
        paint(context, "dim", "  ".join("-" * width for width in widths)),
    ]
    lines.extend("  ".join(pad(cell, c) for c, cell in enumerate(row)) for row in rows)
    return "\n".join(lines)


def short(value: Range | None, unit: str) -> str:
    return "unknown" if value is None else f"{display_number(value.central)} {unit}"


def readout(context: Context, totals: Aggregate) -> list[str]:
    ascii_only = context.ascii
    return [
        f"  energy  {format_range(totals.energy_wh, 'Wh', totals.flags, True, ascii_only)}",
        f"  water   {format_range(totals.water_ml, 'mL', totals.flags, True, ascii_only)}",
        f"  carbon  {format_range(totals.carbon_g, 'g', totals.flags, True, ascii_only)}",
    ]


def caveats(context: Context, totals: Aggregate) -> list[str]:
    lines: list[str] = []
    if totals.unknown_model_count > 0:
        lines.append(
            paint(
                context,
                "yellow",
                f"  {totals.unknown_model_count} of {totals.count} turns used a model we do not "
                "recognise. They are not in the figures above.",
            )
        )
    if totals.no_benchmark_count > 0:
        lines.append(
            paint(
                context,
                "yellow",
                f"  {totals.no_benchmark_count} turns used a model nobody has measured. "
                "They are not in the figures above.",
            )
        )
    if "thinking-unknown" in totals.flags:
        lines.append(
            "  Some turns hid their reasoning tokens, so the figures are a lower bound."
        )
    if "proxy-row" in totals.flags:
        lines.append(
            "  Some models have never been measured, so their share is scaled from one that has."
        )
    if "region-default" in totals.flags:
        lines.append(
            "  No region given, so this uses the world average grid. Pass --region to change it."
        )
    return lines


EXPLAIN = {
    "model-unknown": "We do not recognise this model, so there is no figure to show.",
    "no-benchmark": "We know this model but nobody has published a measurement for it.",
    "tokens-estimated": "Token counts come from our own tokenizer, not from the provider.",
    "thinking-unknown": (
        "This model thinks before it answers and did not say how much, so the figure is a "
        "lower bound."
    ),
    "proxy-row": "Scaled from a different model, because nobody has measured this one.",
    "region-default": "No region was given, so this uses the world average grid.",
    "input-partial": "The app hides its system prompt, so the input count is a lower bound.",
    "derived-rate": "The rate was worked out from a single published figure for one exchange.",
    "assumed-token-counts": (
        "The source did not say how long its reference exchange was, so we assumed it."
    ),
    "parametric-rate": "The rate comes from a formula rather than a measurement.",
    "no-energy-figure": (
        "The source published water and carbon but no energy, so energy is unknown."
    ),
    "scaled-direct-figure": (
        "Water and carbon were published per exchange and scaled to this one."
    ),
    "local-row-missing": (
        "No measurement exists for this model on your own machine, so a hosted row was used."
    ),
}


# ----------------------------------------------------------------- commands


def cmd_summary(context: Context, args: dict[str, Any]) -> str:
    bucket = args["flags"].get("by") or "day"
    if bucket not in BUCKETS:
        raise ValueError(f"--by must be one of: {', '.join(BUCKETS)}")

    pairs = load_events(context)
    buckets = aggregate(pairs, bucket)
    totals_list = aggregate(pairs, "all")
    totals = totals_list[0] if totals_list else None

    if context.json:
        return emit_json(
            context,
            {
                "command": "summary",
                "by": bucket,
                "window": {"since": context.since, "until": context.until},
                "settings": {
                    "region": context.region_code or context.dataset["defaultRegion"],
                    "waterScope": context.water_scope,
                    "carbonBasis": context.carbon_basis,
                },
                "totals": (
                    {
                        "count": totals.count,
                        "energyWh": range_out(totals.energy_wh),
                        "waterMl": range_out(totals.water_ml),
                        "carbonG": range_out(totals.carbon_g),
                        "unknownModelCount": totals.unknown_model_count,
                        "noBenchmarkCount": totals.no_benchmark_count,
                        "flags": totals.flags,
                    }
                    if totals
                    else None
                ),
                "buckets": [
                    {
                        "key": one.key,
                        "from": one.from_,
                        "to": one.to,
                        "count": one.count,
                        "energyWh": range_out(one.energy_wh),
                        "waterMl": range_out(one.water_ml),
                        "carbonG": range_out(one.carbon_g),
                        "byModel": one.by_model,
                        "bySurface": one.by_surface,
                        "unknownModelCount": one.unknown_model_count,
                        "noBenchmarkCount": one.no_benchmark_count,
                        "flags": one.flags,
                    }
                    for one in buckets
                ],
            },
        )

    if totals is None or totals.count == 0:
        return "No sessions found in that window. Try a longer one with --since, or check --source."

    window = f"since {context.since[:10]}" if context.since else "all time"
    lines = [paint(context, "bold", f"{totals.count} turns, {window}"), ""]
    lines.extend(readout(context, totals))

    for quantity, value in (
        ("energy", totals.energy_wh.central if totals.energy_wh else None),
        ("water", totals.water_ml.central if totals.water_ml else None),
        ("carbon", totals.carbon_g.central if totals.carbon_g else None),
    ):
        found = equivalents(value, quantity, context.dataset, 1)
        if found:
            one = found[0]
            note = ", from a figure now seventeen years old" if one["stale"] else ""
            lines.append(
                paint(context, "dim", f"          about {one['count']:.1f} {one['label']}{note}")
            )

    lines.append("")
    lines.append(
        table(
            context,
            [bucket, "turns", "energy", "water", "carbon"],
            [
                [
                    one.key,
                    str(one.count),
                    short(one.energy_wh, "Wh"),
                    short(one.water_ml, "mL"),
                    short(one.carbon_g, "g"),
                ]
                for one in buckets
            ],
            ["left", "right", "right", "right", "right"],
        )
    )

    notes = caveats(context, totals)
    if notes:
        lines.append("")
        lines.extend(notes)

    lines.append("")
    lines.append(
        paint(
            context,
            "dim",
            f"  dataset {context.dataset['version']} · region "
            f"{context.region_code or context.dataset['defaultRegion']} · water "
            f"{context.water_scope} · estimate, not a measurement",
        )
    )
    return "\n".join(lines)


def cmd_sessions(context: Context, args: dict[str, Any]) -> str:
    pairs = load_events(context)
    buckets = sorted(aggregate(pairs, "session"), key=lambda one: one.from_)

    if context.json:
        return emit_json(
            context,
            {
                "command": "sessions",
                "sessions": [
                    {
                        "id": one.key,
                        "from": one.from_,
                        "to": one.to,
                        "turns": one.count,
                        "energyWh": range_out(one.energy_wh),
                        "waterMl": range_out(one.water_ml),
                        "carbonG": range_out(one.carbon_g),
                        "surfaces": one.by_surface,
                        "models": one.by_model,
                        "unknownModelCount": one.unknown_model_count,
                        "flags": one.flags,
                    }
                    for one in buckets
                ],
            },
        )

    if not buckets:
        return "No sessions found in that window."

    return table(
        context,
        ["session", "started", "turns", "energy", "water", "carbon"],
        [
            [
                (one.key[:19] + "…") if len(one.key) > 20 else one.key,
                one.from_[:16].replace("T", " "),
                str(one.count),
                short(one.energy_wh, "Wh"),
                short(one.water_ml, "mL"),
                short(one.carbon_g, "g"),
            ]
            for one in buckets
        ],
        ["left", "left", "right", "right", "right", "right"],
    )


def _share(one: Aggregate, totals: Aggregate) -> str:
    if one.energy_wh is None:
        return "unknown"
    whole = (totals.energy_wh.central if totals.energy_wh else 0) or 1
    return f"{round(one.energy_wh.central / whole * 100)}%"


def cmd_session(context: Context, args: dict[str, Any]) -> str:
    wanted = args["positional"][0] if args["positional"] else None
    if not wanted:
        raise ValueError('Which session? Run "betteruseofai sessions" to see the list.')

    pairs = load_events(context)
    mine = [
        pair
        for pair in pairs
        if pair[0].session_id == wanted or (pair[0].session_id or "").startswith(wanted)
    ]
    if not mine:
        raise ValueError(f'No session here matches "{wanted}".')

    totals = aggregate(mine, "all")[0]
    by_model = aggregate(mine, "model")
    heaviest = sorted(
        [pair for pair in mine if pair[1].energy_wh is not None],
        key=lambda pair: -pair[1].energy_wh.central,
    )[:5]

    if context.json:
        return emit_json(
            context,
            {
                "command": "session",
                "session": {
                    "id": mine[0][0].session_id or wanted,
                    "from": totals.from_,
                    "to": totals.to,
                    "turns": totals.count,
                    "energyWh": range_out(totals.energy_wh),
                    "waterMl": range_out(totals.water_ml),
                    "carbonG": range_out(totals.carbon_g),
                    "unknownModelCount": totals.unknown_model_count,
                    "noBenchmarkCount": totals.no_benchmark_count,
                    "flags": totals.flags,
                    "byModel": [
                        {
                            "model": one.key,
                            "turns": one.count,
                            "energyWh": range_out(one.energy_wh),
                        }
                        for one in by_model
                    ],
                    "heaviestTurns": [
                        {
                            "id": event.id,
                            "timestamp": event.timestamp,
                            "model": est.model_id,
                            "energyWh": range_out(est.energy_wh),
                            "inputTokens": event.tokens.input or 0,
                            "outputTokens": event.tokens.output or 0,
                            "cachedReadTokens": event.tokens.cached_read or 0,
                            "cachedWriteTokens": event.tokens.cached_write or 0,
                            "thinkingTokens": (
                                event.tokens.thinking
                                if isinstance(event.tokens.thinking, int)
                                else None
                            ),
                        }
                        for event, est in heaviest
                    ],
                },
            },
        )

    lines = [
        paint(context, "bold", f"Session {mine[0][0].session_id or wanted}"),
        paint(
            context,
            "dim",
            f"{totals.count} turns, {totals.from_[:16].replace('T', ' ')} to "
            f"{totals.to[11:16]} UTC",
        ),
        "",
    ]
    lines.extend(readout(context, totals))

    found = equivalents(
        totals.energy_wh.central if totals.energy_wh else None, "energy", context.dataset, 2
    )
    if found:
        joined = ", or ".join(f"{one['count']:.1f} {one['label']}" for one in found)
        lines.append(paint(context, "dim", f"          about {joined}"))

    lines.append("")
    lines.append(
        table(
            context,
            ["model", "turns", "energy", "share"],
            [
                [
                    (get_model(one.key, context.dataset) or {}).get("displayName", one.key),
                    str(one.count),
                    short(one.energy_wh, "Wh"),
                    _share(one, totals),
                ]
                for one in by_model
            ],
            ["left", "right", "right", "right"],
        )
    )

    if heaviest:
        lines.append("")
        lines.append(paint(context, "dim", "HEAVIEST TURNS"))
        lines.append(
            table(
                context,
                ["at", "model", "in", "cache read", "cache write", "out", "thinking", "energy"],
                [
                    [
                        event.timestamp[11:19],
                        est.model_id or "unknown",
                        str(event.tokens.input or 0),
                        str(event.tokens.cached_read or 0),
                        str(event.tokens.cached_write or 0),
                        str(event.tokens.output or 0),
                        (
                            "not said"
                            if not isinstance(event.tokens.thinking, int)
                            else str(event.tokens.thinking)
                        ),
                        format_range(est.energy_wh, "Wh", est.flags, False, context.ascii),
                    ]
                    for event, est in heaviest
                ],
                ["left", "left", "right", "right", "right", "right", "right", "right"],
            )
        )

    notes = caveats(context, totals)
    if notes:
        lines.append("")
        lines.extend(notes)

    why = [EXPLAIN[flag] for flag in totals.flags if flag in EXPLAIN]
    if why:
        lines.append("")
        lines.append(paint(context, "dim", "WHY THE FIGURES ARE UNCERTAIN"))
        lines.extend(f"  {line}" for line in why)

    return "\n".join(lines)


def cmd_models(context: Context, args: dict[str, Any]) -> str:
    show_all = bool(args["flags"].get("all"))
    at = context.iso_now()[:10]

    rows = []
    for model in context.dataset["models"]:
        row = select_benchmark(model, context.dataset, at=at)
        target = downgrade_target(model, context.dataset)
        rows.append((model, row, target))

    if context.json:
        body: dict[str, Any] = {
            "command": "models",
            "models": [
                {
                    "id": model["id"],
                    "displayName": model["displayName"],
                    "provider": model["provider"],
                    "family": model["family"],
                    "tier": model["tier"],
                    "ordinal": model["ordinal"],
                    "reasoning": model["reasoning"],
                    "aliases": sorted(model["aliases"]),
                    "benchmarkRowId": row["id"] if row else None,
                    "methodology": row["methodology"] if row else None,
                    "boundary": row["boundary"] if row else None,
                    "qualityScore": row["qualityScore"] if row else None,
                    "sourceUrl": row["source"]["url"] if row else None,
                    "downgradeTarget": target["id"] if target else None,
                }
                for model, row, target in rows
            ],
        }
        if show_all:
            body["regions"] = [
                {
                    "code": region["code"],
                    "name": region["name"],
                    "gridGco2PerKwh": canonical_number(region["gridGco2PerKwh"]["central"]),
                    "year": region["year"],
                }
                for region in context.dataset["regions"]
            ]
        return emit_json(context, body)

    lines = [
        table(
            context,
            ["model", "tier", "thinks", "measured by", "quality", "one rung down"],
            [
                [
                    model["displayName"],
                    model["tier"],
                    "yes" if model["reasoning"] else "no",
                    row["methodology"] if row else "nothing",
                    f"{row['qualityScore']} of 5" if row else "unknown",
                    target["displayName"] if target else "nothing smaller",
                ]
                for model, row, target in rows
            ],
        )
    ]

    if show_all:
        lines.append("")
        lines.append(paint(context, "dim", "REGIONS"))
        lines.append(
            table(
                context,
                ["code", "name", "gCO2e per kWh", "year"],
                [
                    [
                        region["code"],
                        region["name"],
                        str(round(region["gridGco2PerKwh"]["central"])),
                        str(region["year"]),
                    ]
                    for region in context.dataset["regions"]
                ],
                ["left", "left", "right", "right"],
            )
        )

    lines.append("")
    lines.append(
        paint(
            context,
            "dim",
            "  A quality of 2 means the figure is scaled from a different model, because nobody "
            "has measured this one.",
        )
    )
    return "\n".join(lines)


def cmd_export(context: Context, args: dict[str, Any]) -> str:
    fmt = args["flags"].get("format") or ("json" if context.json else "csv")
    pairs = load_events(context)

    if fmt == "json":
        return emit_json(
            context,
            {
                "command": "export",
                "events": [
                    {
                        "id": event.id,
                        "timestamp": event.timestamp,
                        "surface": event.surface,
                        "sessionId": event.session_id,
                        "modelRaw": event.model_raw,
                        "modelId": est.model_id,
                        "inputTokens": event.tokens.input or 0,
                        "outputTokens": event.tokens.output or 0,
                        "cachedReadTokens": event.tokens.cached_read or 0,
                        "cachedWriteTokens": event.tokens.cached_write or 0,
                        "thinkingTokens": (
                            event.tokens.thinking
                            if isinstance(event.tokens.thinking, int)
                            else None
                        ),
                        "energyWhCentral": (
                            canonical_number(est.energy_wh.central) if est.energy_wh else None
                        ),
                        "waterMlCentral": (
                            canonical_number(est.water_ml.central) if est.water_ml else None
                        ),
                        "carbonGCentral": (
                            canonical_number(est.carbon_g.central) if est.carbon_g else None
                        ),
                        "benchmarkRowId": est.benchmark_row_id,
                        "flags": sorted(est.flags),
                    }
                    for event, est in pairs
                ],
            },
        )

    if fmt != "csv":
        raise ValueError("--format must be csv or json.")

    # An unknown figure is an empty cell, never a zero. A spreadsheet will sum a
    # column of zeroes quite happily and produce a total that is a lie.
    def cell(value: float | None) -> str:
        return "" if value is None else canonical_number(value)

    def escape(text: str) -> str:
        return f'"{text.replace(chr(34), chr(34) * 2)}"' if re.search(r'[",\n]', text) else text

    header = ",".join(
        [
            "timestamp", "surface", "session", "model", "model_raw",
            "input_tokens", "cached_read_tokens", "cached_write_tokens", "output_tokens",
            "thinking_tokens", "energy_wh_low", "energy_wh_central", "energy_wh_high",
            "water_ml_central", "carbon_g_central", "benchmark_row", "flags",
        ]
    )  # fmt: skip

    rows = [
        ",".join(
            escape(text)
            for text in [
                event.timestamp,
                event.surface,
                event.session_id or "",
                est.model_id or "",
                event.model_raw,
                str(event.tokens.input or 0),
                str(event.tokens.cached_read or 0),
                str(event.tokens.cached_write or 0),
                str(event.tokens.output or 0),
                (str(event.tokens.thinking) if isinstance(event.tokens.thinking, int) else ""),
                cell(est.energy_wh.low if est.energy_wh else None),
                cell(est.energy_wh.central if est.energy_wh else None),
                cell(est.energy_wh.high if est.energy_wh else None),
                cell(est.water_ml.central if est.water_ml else None),
                cell(est.carbon_g.central if est.carbon_g else None),
                est.benchmark_row_id or "",
                " ".join(sorted(est.flags)),
            ]
        )
        for event, est in pairs
    ]

    return "\n".join([header, *rows])


def cmd_doctor(context: Context, args: dict[str, Any]) -> str:
    checks: list[dict[str, Any]] = []

    claude_dir = default_claude_dir()
    codex_dir = default_codex_dir()
    claude_there = Path(claude_dir).exists()
    codex_there = Path(codex_dir).exists()

    checks.append(
        {
            "name": "Claude Code transcripts",
            "ok": claude_there,
            "detail": (
                claude_dir
                if claude_there
                else f"Nothing at {claude_dir}. Set BUOA_CLAUDE_DIR if yours lives somewhere else."
            ),
        }
    )
    checks.append(
        {
            "name": "Codex CLI rollouts",
            "ok": codex_there,
            "detail": (
                codex_dir
                if codex_there
                else (
                    f"Nothing at {codex_dir}. Set CODEX_HOME if yours lives somewhere else. "
                    "Rollouts written before 6 September 2025 carry no token counts."
                )
            ),
        }
    )

    python_ok = sys.version_info >= (3, 10)
    checks.append(
        {
            "name": "Python version",
            "ok": python_ok,
            "detail": (
                f"{sys.version_info.major}.{sys.version_info.minor}"
                if python_ok
                else "we need 3.10 or newer"
            ),
        }
    )
    checks.append(
        {
            "name": "Dataset",
            "ok": True,
            "detail": (
                f"{context.dataset['version']}, {len(context.dataset['benchmarks'])} benchmark "
                f"rows, sha {context.dataset['sha256'][:12]}"
            ),
        }
    )

    pairs = load_events(context)
    warnings = [w for result in context.reader_results for w in result.warnings]  # type: ignore[attr-defined]
    unknown = [pair for pair in pairs if "model-unknown" in pair[1].flags]

    checks.append(
        {
            "name": "Turns found",
            "ok": len(pairs) > 0,
            "detail": (
                f"{len(pairs)} in the window"
                if pairs
                else "none in the window; try --since 30d"
            ),
        }
    )
    names = sorted({pair[0].model_raw for pair in unknown})
    checks.append(
        {
            "name": "Models recognised",
            "ok": not unknown,
            "detail": (
                "all of them"
                if not unknown
                else (
                    f"{len(unknown)} turns used: {', '.join(names)}. "
                    "Adding them to the dataset would fix that."
                )
            ),
        }
    )
    checks.append(
        {
            "name": "Lines we could not parse",
            "ok": not warnings,
            "detail": "none" if not warnings else f"{len(warnings)}, which were skipped",
        }
    )

    if context.json:
        return emit_json(context, {"command": "doctor", "checks": checks})

    lines = [
        f"  {paint(context, 'green', 'ok  ') if check['ok'] else paint(context, 'yellow', 'note')}"
        f"  {check['name']:<26}  {check['detail']}"
        for check in checks
    ]
    lines.append("")
    lines.append(
        paint(
            context,
            "dim",
            "  Nothing here contacts a network. Every figure is worked out on this machine.",
        )
    )
    return "\n".join(lines)


COMMANDS = {
    "summary": cmd_summary,
    "sessions": cmd_sessions,
    "session": cmd_session,
    "export": cmd_export,
    "models": cmd_models,
    "doctor": cmd_doctor,
}


def run(argv: list[str]) -> tuple[str, str, int]:
    args = parse_args(argv)

    if args["errors"]:
        return (
            "",
            "\n".join(args["errors"]) + '\n\nRun "betteruseofai --help" for the options.',
            2,
        )

    if args["flags"].get("version"):
        dataset = load_dataset()
        return (
            f"betteruseofai {VERSION}, dataset {dataset['version']} ({dataset['sha256'][:12]})",
            "",
            0,
        )

    if args["command"] in ("", "help"):
        return USAGE, "", 0

    if args["flags"].get("help"):
        return USAGE, "", 0

    context = Context(args)
    if context.errors:
        return "", "\n".join(context.errors), 2

    handler = COMMANDS.get(args["command"])
    if handler is None:
        return (
            "",
            f'No such command: {args["command"]}\n\nRun "betteruseofai --help" for the list.',
            2,
        )

    try:
        return handler(context, args), "", 0
    except ValueError as cause:
        return "", str(cause), 1


def main() -> None:
    stdout, stderr, code = run(sys.argv[1:])
    if stdout:
        sys.stdout.write(stdout + "\n")
    if stderr:
        sys.stderr.write(stderr + "\n")
    sys.exit(code)


if __name__ == "__main__":
    main()
