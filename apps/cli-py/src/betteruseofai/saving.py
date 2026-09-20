"""What using smaller models has saved, mirroring packages/core/src/saving.ts.

A counterfactual with a stated baseline: every turn re-priced as if it had gone
to rung zero of its own family, minus what it actually cost. A turn already on
the frontier model saves nothing. A turn on an unrecognised model cannot be
re-priced and is left out, and the count of those is returned so the page can
say so. Every figure stays a range and both estimates share rows, region and
scope, so the difference is between like and like.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any

from .engine import Range, get_model
from .estimate import Estimate, UsageEvent, estimate

SAVING_BASELINE = "the largest model in each family"


@dataclass
class DaySaving:
    day: str
    energy_wh: Range | None


@dataclass
class Saving:
    baseline: str
    energy_wh: Range | None
    water_ml: Range | None
    carbon_g: Range | None
    by_day: list[DaySaving]
    skipped: int


def _plus(a: Range | None, b: Range | None) -> Range | None:
    if a is None:
        return b
    if b is None:
        return a
    return Range(a.low + b.low, a.central + b.central, a.high + b.high)


def _minus(a: Range | None, b: Range | None) -> Range | None:
    """A minus B, floored at nothing. A saving is never negative."""
    if a is None or b is None:
        return None
    return Range(
        max(0.0, a.low - b.high), max(0.0, a.central - b.central), max(0.0, a.high - b.low)
    )


def saving(
    pairs: list[tuple[UsageEvent, Estimate]],
    dataset: dict[str, Any],
    region_code: str | None = None,
    water_scope: str = "on-site + off-site",
    carbon_basis: str = "location-based",
) -> Saving:
    energy: Range | None = None
    water: Range | None = None
    carbon: Range | None = None
    skipped = 0
    days: dict[str, Range | None] = {}

    for event, actual in pairs:
        day = event.timestamp[:10]
        model = get_model(actual.model_id, dataset)
        if model is None or actual.energy_wh is None:
            skipped += 1
            continue
        if model["ordinal"] == 0:
            # Already the top of the ladder. Nothing saved, nothing skipped.
            days.setdefault(day, None)
            continue
        top = next(
            (m for m in dataset["models"] if m["family"] == model["family"] and m["ordinal"] == 0),
            None,
        )
        if top is None:
            skipped += 1
            continue

        counterfactual = estimate(
            replace(event, model_raw=top["id"]),
            dataset,
            region_code=region_code,
            water_scope=water_scope,
            carbon_basis=carbon_basis,
        )

        saved = _minus(counterfactual.energy_wh, actual.energy_wh)
        energy = _plus(energy, saved)
        water = _plus(water, _minus(counterfactual.water_ml, actual.water_ml))
        carbon = _plus(carbon, _minus(counterfactual.carbon_g, actual.carbon_g))
        days[day] = _plus(days.get(day), saved)

    return Saving(
        baseline=SAVING_BASELINE,
        energy_wh=energy,
        water_ml=water,
        carbon_g=carbon,
        by_day=[DaySaving(day, days[day]) for day in sorted(days)],
        skipped=skipped,
    )
