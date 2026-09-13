"""The estimation engine, ported from packages/core.

This is a deliberate line by line mirror of the TypeScript, not a rewrite. Where
the two could reasonably differ, the TypeScript wins, because it is the one the
extension and the website also run. The parity job compares the JSON the two
tools produce from the same fixtures and fails on any byte of difference.

The rule that governs every branch: when we do not know something, the answer is
None and a flag says why. Nothing here turns a missing value into a zero.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path
from typing import Any

# ----------------------------------------------------------------- ranges


@dataclass(frozen=True)
class Range:
    low: float
    central: float
    high: float

    def as_dict(self) -> dict[str, float]:
        return {"low": self.low, "central": self.central, "high": self.high}


ZERO = Range(0.0, 0.0, 0.0)


def exact(value: float) -> Range:
    return Range(value, value, value)


def to_range(raw: Any) -> Range | None:
    if not isinstance(raw, dict):
        return None
    return Range(float(raw["low"]), float(raw["central"]), float(raw["high"]))


def add(a: Range, b: Range) -> Range:
    return Range(a.low + b.low, a.central + b.central, a.high + b.high)


def mul(a: Range, b: Range) -> Range:
    """Bound by bound, which treats the two as perfectly correlated.

    That widens faster than a proper propagation would, and that is the
    direction to err in: an over-wide range is honest, an over-narrow one is a
    false claim.
    """
    return Range(a.low * b.low, a.central * b.central, a.high * b.high)


def scale(a: Range, factor: float) -> Range:
    return Range(a.low * factor, a.central * factor, a.high * factor)


def order(r: Range) -> Range:
    low, central, high = sorted((r.low, r.central, r.high))
    return Range(low, central, high)


def clamp_non_negative(r: Range) -> Range:
    return Range(max(0.0, r.low), max(0.0, r.central), max(0.0, r.high))


# ---------------------------------------------------------------- dataset


def load_dataset(path: str | Path | None = None) -> dict[str, Any]:
    """Read the dataset bundle vendored into this package at build time."""
    if path is not None:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    with resources.files("betteruseofai.data").joinpath("dataset.json").open(
        "r", encoding="utf-8"
    ) as handle:
        return json.load(handle)


def load_tokens() -> dict[str, Any]:
    """Read the design tokens vendored beside the dataset.

    Only the terminal block is used here: the escape codes and the meter
    glyphs, so the two tools and the website read their colours from one file.
    """
    with resources.files("betteruseofai.data").joinpath("tokens.json").open(
        "r", encoding="utf-8"
    ) as handle:
        return json.load(handle)


_SYNTHETIC = {"<synthetic>", "synthetic"}


def resolve_model(raw: str | None, dataset: dict[str, Any]) -> dict[str, Any] | None:
    """Turn a raw model string into a model, or into None.

    No fuzzy matching and no prefix guessing. A wrong match gives a confident
    number for the wrong model, which is worse than saying we do not know.
    """
    if not raw:
        return None
    key = raw.strip().lower()
    if key in _SYNTHETIC:
        return None
    index = dataset.get("_aliasIndex")
    if index is None:
        index = {}
        for model in dataset["models"]:
            index[model["id"].strip().lower()] = model
            for alias in model["aliases"]:
                index[alias.strip().lower()] = model
        dataset["_aliasIndex"] = index
    return index.get(key)


def get_model(model_id: str | None, dataset: dict[str, Any]) -> dict[str, Any] | None:
    if not model_id:
        return None
    return next((m for m in dataset["models"] if m["id"] == model_id), None)


def get_region(dataset: dict[str, Any], code: str | None) -> dict[str, Any] | None:
    if not code:
        return None
    return next((r for r in dataset["regions"] if r["code"] == code), None)


def downgrade_target(model: dict[str, Any], dataset: dict[str, Any]) -> dict[str, Any] | None:
    """The next rung down the same ladder, or None at the bottom."""
    return next(
        (
            candidate
            for candidate in dataset["models"]
            if candidate["family"] == model["family"]
            and candidate["ordinal"] == model["ordinal"] + 1
            and candidate.get("deprecated") is None
        ),
        None,
    )


_SHAPE_RANK = {"per-query-set": 0, "per-token": 1, "parametric": 2, "per-prompt": 3, "proxy": 4}
_METHODOLOGY_RANK = {
    "provider-measured": 0,
    "independent-benchmark": 1,
    "provider-statement": 2,
    "parametric-model": 3,
    "proxy": 4,
}


def select_benchmark(
    model: dict[str, Any],
    dataset: dict[str, Any],
    at: str | None = None,
    hosting: str = "cloud",
) -> dict[str, Any] | None:
    """Pick the row to estimate from.

    Quality first, then rows that model token scaling, then measurement over
    formula over guess, then the most recent. The final tiebreak is the row id,
    so the choice is deterministic and both implementations agree.
    """
    candidates = [
        row
        for row in dataset["benchmarks"]
        if model["id"] in row["modelIds"]
        and not (at and row["validFrom"] > at)
        and not (at and row.get("validTo") and row["validTo"] < at)
    ]
    if not candidates:
        return None

    matching = [row for row in candidates if row.get("hosting", "cloud") == hosting]
    if matching:
        candidates = matching

    def key(row: dict[str, Any]) -> tuple[Any, ...]:
        return (
            -row["qualityScore"],
            _SHAPE_RANK[row["shape"]],
            _METHODOLOGY_RANK[row["methodology"]],
            # Most recent first, so the date sorts descending against the rest.
            tuple(-ord(c) for c in row["validFrom"]),
            row["id"],
        )

    return sorted(candidates, key=key)[0]


# -------------------------------------------------------------- normalise


@dataclass
class PerTokenRates:
    intercept_wh: Range
    input_wh: Range
    output_wh: Range
    flags: list[str] = field(default_factory=list)
    root_row_id: str = ""


def _widen(rate: Range, factor: Range) -> Range:
    return order(
        Range(rate.low * factor.low, rate.central * factor.central, rate.high * factor.high)
    )


def fit_query_set(
    points: list[dict[str, float]], output_to_input_weight: float = 8.0
) -> tuple[float, float, float]:
    """Least squares fit of wh = a + b_in * input + b_out * output.

    Returns (intercept, input rate, output rate). Two departures from a plain
    fit, both because a plain fit produces a number that would be a lie:

    A column that never varies cannot be told apart from the intercept. Epoch
    held output at 500 tokens and varied only the context, so a plain fit
    reports that an output token is free. We fit without the constant column and
    then hand the intercept to it. Where that leaves nothing to hand over, the
    constant column is priced off the column that did vary.

    And a negative coefficient would mean a longer prompt costs less, so when
    one appears we drop that term and refit on the rest.
    """
    columns = ("intercept", "input", "output")

    def value_of(column: str, point: dict[str, float]) -> float:
        if column == "intercept":
            return 1.0
        return float(point["inputTokens"] if column == "input" else point["outputTokens"])

    def solve_for(active: list[str]) -> dict[str, float] | None:
        n = len(active)
        # Normal equations with a small ridge term, so a rank deficient set still solves.
        ata = [
            [
                (1e-12 if i == j else 0.0)
                + sum(value_of(active[i], p) * value_of(active[j], p) for p in points)
                for j in range(n)
            ]
            for i in range(n)
        ]
        atb = [sum(value_of(active[i], p) * float(p["energyWh"]) for p in points) for i in range(n)]

        for col in range(n):
            pivot = max(range(col, n), key=lambda r: abs(ata[r][col]))
            if abs(ata[pivot][col]) < 1e-15:
                return None
            ata[col], ata[pivot] = ata[pivot], ata[col]
            atb[col], atb[pivot] = atb[pivot], atb[col]
            for row in range(col + 1, n):
                factor = ata[row][col] / ata[col][col]
                if factor == 0:
                    continue
                for k in range(col, n):
                    ata[row][k] -= factor * ata[col][k]
                atb[row] -= factor * atb[col]

        solution = [0.0] * n
        for row in range(n - 1, -1, -1):
            total = atb[row]
            for col in range(row + 1, n):
                total -= ata[row][col] * solution[col]
            solution[row] = total / ata[row][row]

        result = {"intercept": 0.0, "input": 0.0, "output": 0.0}
        for index, column in enumerate(active):
            result[column] = solution[index]
        return result

    def constant(column: str) -> bool:
        values = [value_of(column, p) for p in points]
        return values[0] > 0 and all(v == values[0] for v in values)

    def varies(column: str) -> bool:
        return len({value_of(column, p) for p in points}) > 1

    constant_column = next((c for c in ("input", "output") if constant(c)), None)
    varying_column = next((c for c in ("input", "output") if varies(c)), None)

    if constant_column and varying_column:
        pair = solve_for(["intercept", varying_column])
        if pair is not None:
            constant_value = value_of(constant_column, points[0])
            varying_rate = max(0.0, pair[varying_column])
            per_constant = max(0.0, pair["intercept"]) / constant_value
            if per_constant <= 0:
                per_constant = (
                    varying_rate * output_to_input_weight
                    if constant_column == "output"
                    else varying_rate / output_to_input_weight
                )
            rates = {"intercept": 0.0, "input": 0.0, "output": 0.0}
            rates[varying_column] = varying_rate
            rates[constant_column] = per_constant
            return rates["intercept"], rates["input"], rates["output"]

    active = list(columns)
    solved = solve_for(active)
    for _ in range(2):
        if solved is None:
            break
        offender = next((c for c in active if solved[c] < 0), None)
        if offender is None:
            break
        active = [c for c in active if c != offender]
        if not active:
            break
        solved = solve_for(active)

    if solved is None:
        return 0.0, 0.0, 0.0
    return (
        max(0.0, solved["intercept"]),
        max(0.0, solved["input"]),
        max(0.0, solved["output"]),
    )


def ecologits_wh_per_output_token(coefficients: dict[str, float], active_params_b: float) -> float:
    """EcoLogits energy per output token, in watt hours.

    The published coefficients are read as kilowatt hours per thousand output
    tokens. The unit convention is not fully pinned down, which is why every
    parametric result is widened and flagged, and why a measured row always
    wins over this one.
    """
    alpha = coefficients["alphaKwhPerTokenPerB"]
    beta = coefficients["betaPerB"]
    gamma = coefficients["gammaKwhPerToken"]
    kwh_per_thousand = alpha * math.exp(beta * active_params_b) * active_params_b + gamma
    return kwh_per_thousand * 1000 / 1000


def normalize_to_per_token(
    row: dict[str, Any],
    dataset: dict[str, Any],
    model: dict[str, Any],
    seen: set[str] | None = None,
) -> PerTokenRates | None:
    calibration = dataset["calibration"]
    seen = seen if seen is not None else set()
    if row["id"] in seen:
        return None
    seen.add(row["id"])

    shape = row["shape"]
    flags: list[str] = []

    if shape == "per-token":
        per_token = row.get("perToken")
        if not per_token:
            return None
        return PerTokenRates(
            ZERO,
            to_range(per_token["energyWhPerInputToken"]),
            to_range(per_token["energyWhPerOutputToken"]),
            flags,
            row["id"],
        )

    if shape == "per-prompt":
        per_prompt = row.get("perPrompt")
        if not per_prompt or not per_prompt.get("energyWh"):
            # A row that publishes water and carbon but no energy, such as the
            # Mistral assessment, cannot produce a per token rate at all.
            return None
        k = to_range(calibration["outputToInputEnergyWeight"])
        reference_input = float(per_prompt["referenceInputTokens"]["central"])
        reference_output = float(per_prompt["referenceOutputTokens"]["central"])
        denominator = reference_input + k.central * reference_output
        if denominator <= 0:
            return None

        energy = to_range(per_prompt["energyWh"])
        input_rate = Range(
            energy.low / denominator, energy.central / denominator, energy.high / denominator
        )
        output_rate = scale(input_rate, k.central)

        flags.append("derived-rate")
        widening = to_range(calibration["derivedRowWidening"])
        if not per_prompt.get("tokenCountsPublished"):
            flags.append("assumed-token-counts")
            extra = to_range(calibration.get("assumedTokenCountWidening"))
            if extra is not None:
                widening = Range(
                    widening.low * extra.low,
                    widening.central * extra.central,
                    widening.high * extra.high,
                )

        return PerTokenRates(
            ZERO, _widen(input_rate, widening), _widen(output_rate, widening), flags, row["id"]
        )

    if shape == "per-query-set":
        query_set = row.get("perQuerySet")
        if not query_set or len(query_set["points"]) < 2:
            return None
        intercept, input_wh, output_wh = fit_query_set(
            query_set["points"], float(calibration["outputToInputEnergyWeight"]["central"])
        )
        uncertainty = to_range(
            query_set.get("relativeUncertainty") or calibration["derivedRowWidening"]
        )
        return PerTokenRates(
            _widen(exact(intercept), uncertainty),
            _widen(exact(input_wh), uncertainty),
            _widen(exact(output_wh), uncertainty),
            flags,
            row["id"],
        )

    if shape == "parametric":
        parametric = row.get("parametric")
        params = to_range(model.get("activeParamsB"))
        if not parametric or params is None:
            return None
        coefficients = parametric["coefficients"]
        per_output = Range(
            ecologits_wh_per_output_token(coefficients, params.low),
            ecologits_wh_per_output_token(coefficients, params.central),
            ecologits_wh_per_output_token(coefficients, params.high),
        )
        widening = to_range(
            calibration.get("parametricWidening") or calibration["derivedRowWidening"]
        )
        output = _widen(order(per_output), widening)
        k = to_range(calibration["outputToInputEnergyWeight"])
        input_rate = order(
            Range(output.low / k.high, output.central / k.central, output.high / k.low)
        )
        flags.append("parametric-rate")
        return PerTokenRates(ZERO, input_rate, output, flags, row["id"])

    if shape == "proxy":
        parent_id = row.get("proxyOf")
        factor = to_range(row.get("proxyFactor"))
        if not parent_id or factor is None:
            return None
        parent = next((r for r in dataset["benchmarks"] if r["id"] == parent_id), None)
        if parent is None:
            return None
        # The parent describes a different model, so normalise it against the
        # model it was actually measured on.
        parent_model = next(
            (m for m in dataset["models"] if m["id"] in parent["modelIds"]), model
        )
        base = normalize_to_per_token(parent, dataset, parent_model, seen)
        if base is None:
            return None
        return PerTokenRates(
            clamp_non_negative(mul(base.intercept_wh, factor)),
            clamp_non_negative(mul(base.input_wh, factor)),
            clamp_non_negative(mul(base.output_wh, factor)),
            [*base.flags, "proxy-row"],
            base.root_row_id,
        )

    return None
