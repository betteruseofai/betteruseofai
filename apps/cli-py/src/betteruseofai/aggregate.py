"""Rolling estimates up, and the everyday comparisons. Mirrors core's aggregate and equivalents."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .engine import Range, add
from .estimate import Estimate, UsageEvent

BUCKETS = ("day", "week", "model", "surface", "session", "hosting", "all")


@dataclass
class Aggregate:
    key: str
    bucket: str
    from_: str
    to: str
    count: int
    energy_wh: Range | None
    water_ml: Range | None
    carbon_g: Range | None
    by_surface: dict[str, int] = field(default_factory=dict)
    by_hosting: dict[str, int] = field(default_factory=dict)
    by_model: dict[str, int] = field(default_factory=dict)
    unknown_model_count: int = 0
    no_benchmark_count: int = 0
    flags: list[str] = field(default_factory=list)


def _iso_day(timestamp: str) -> str:
    return timestamp[:10]


def _iso_week_start(timestamp: str) -> str:
    """The Monday of the week containing this timestamp."""
    date = datetime.strptime(_iso_day(timestamp), "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return (date - timedelta(days=date.weekday())).strftime("%Y-%m-%d")


def _key_for(bucket: str, event: UsageEvent, estimate: Estimate) -> str:
    if bucket == "day":
        return _iso_day(event.timestamp)
    if bucket == "week":
        return _iso_week_start(event.timestamp)
    if bucket == "model":
        return estimate.model_id or "unknown"
    if bucket == "surface":
        return event.surface
    if bucket == "session":
        return event.session_id or "no-session"
    if bucket == "hosting":
        return event.hosting
    return "all"


def aggregate(pairs: list[tuple[UsageEvent, Estimate]], bucket: str = "all") -> list[Aggregate]:
    """Group and total.

    Events we could not price are counted in their own field and never folded
    into the totals as zero, so a week full of unrecognised models does not read
    as a light week. A bucket where nothing could be priced has None totals.
    """
    buckets: dict[str, list[tuple[UsageEvent, Estimate]]] = {}
    for event, est in pairs:
        buckets.setdefault(_key_for(bucket, event, est), []).append((event, est))

    result: list[Aggregate] = []
    for key, group in buckets.items():
        timestamps = sorted(event.timestamp for event, _ in group)
        energy: Range | None = None
        water: Range | None = None
        carbon: Range | None = None
        unknown = 0
        no_benchmark = 0
        by_surface: dict[str, int] = {}
        by_hosting: dict[str, int] = {}
        by_model: dict[str, int] = {}
        flags: set[str] = set()

        for event, est in group:
            by_surface[event.surface] = by_surface.get(event.surface, 0) + 1
            by_hosting[event.hosting] = by_hosting.get(event.hosting, 0) + 1
            model_key = est.model_id or "unknown"
            by_model[model_key] = by_model.get(model_key, 0) + 1
            flags.update(est.flags)

            if "model-unknown" in est.flags:
                unknown += 1
            if "no-benchmark" in est.flags:
                no_benchmark += 1

            if est.energy_wh is not None:
                energy = add(energy, est.energy_wh) if energy else est.energy_wh
            if est.water_ml is not None:
                water = add(water, est.water_ml) if water else est.water_ml
            if est.carbon_g is not None:
                carbon = add(carbon, est.carbon_g) if carbon else est.carbon_g

        result.append(
            Aggregate(
                key=key,
                bucket=bucket,
                from_=timestamps[0] if timestamps else "",
                to=timestamps[-1] if timestamps else "",
                count=len(group),
                energy_wh=energy,
                water_ml=water,
                carbon_g=carbon,
                by_surface=by_surface,
                by_hosting=by_hosting,
                by_model=by_model,
                unknown_model_count=unknown,
                no_benchmark_count=no_benchmark,
                flags=sorted(flags),
            )
        )

    return sorted(result, key=lambda one: one.key)


def equivalents(
    value: float | None, quantity: str, dataset: dict[str, Any], limit: int = 2
) -> list[dict[str, Any]]:
    """Pick the everyday comparisons that actually help.

    A hard tier first: a whole number of something beats a fraction of something
    bigger, and a comparison marked stale is the last resort. Then, within a
    tier, distance from one in orders of magnitude.
    """
    if value is None or not math.isfinite(value) or value <= 0:
        return []

    candidates = []
    for entry in dataset["equivalents"]:
        if entry["quantity"] != quantity:
            continue
        count = value / entry["amount"]
        if count < 0.1 or count > 100:
            continue
        tier = (2 if entry.get("stale") else 0) + (1 if count < 1 else 0)
        candidates.append((tier, abs(math.log10(count)), entry["id"], entry, count))

    candidates.sort(key=lambda item: (item[0], item[1], item[2]))

    return [
        {
            "id": entry["id"],
            "count": count,
            "label": entry["singular"] if 0.995 <= count < 1.005 else entry["plural"],
            "stale": entry.get("stale") is True,
            "source": entry["source"],
        }
        for _tier, _distance, _id, entry, count in candidates[:limit]
    ]
