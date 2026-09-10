"""Turning one exchange into energy, water and carbon. Mirrors packages/core/src/estimate.ts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .engine import (
    ZERO,
    Range,
    add,
    clamp_non_negative,
    exact,
    get_region,
    mul,
    normalize_to_per_token,
    order,
    resolve_model,
    scale,
    select_benchmark,
    to_range,
)

WATER_SCOPES = ("on-site", "on-site + off-site", "lifecycle")


@dataclass
class TokenCounts:
    input: int | None = 0
    output: int | None = 0
    cached_read: int = 0
    cached_write: int = 0
    # A number is a reported count, None means the model can think and did not
    # say, and "absent" means the model cannot think at all. Collapsing any of
    # these into another is the exact failure this project exists to avoid.
    thinking: int | None | str = "absent"
    tool: int = 0
    estimated: bool = False
    estimator: str = "provider"


@dataclass
class UsageEvent:
    id: str
    surface: str
    hosting: str
    model_raw: str
    tokens: TokenCounts
    timestamp: str
    session_id: str | None = None
    region_hint: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class Estimate:
    event_id: str
    model_id: str | None
    dataset_version: str
    energy_wh: Range | None
    water_ml: Range | None
    carbon_g: Range | None
    benchmark_row_id: str | None
    benchmark_parent_id: str | None
    methodology: str | None
    boundary: str | None
    region_code: str
    thinking_handling: str
    thinking_tokens: Range | None
    water_scope: str
    carbon_basis: str
    quality_score: int | None
    flags: list[str]
    sources: list[dict[str, Any]]


def _unknown(
    event: UsageEvent,
    dataset_version: str,
    region_code: str,
    flags: list[str],
    thinking_handling: str,
    model_id: str | None = None,
) -> Estimate:
    return Estimate(
        event_id=event.id,
        model_id=model_id,
        dataset_version=dataset_version,
        energy_wh=None,
        water_ml=None,
        carbon_g=None,
        benchmark_row_id=None,
        benchmark_parent_id=None,
        methodology=None,
        boundary=None,
        region_code=region_code,
        thinking_handling=thinking_handling,
        thinking_tokens=None,
        water_scope="on-site + off-site",
        carbon_basis="location-based",
        quality_score=None,
        flags=flags,
        sources=[],
    )


def _thinking_for(
    tokens: TokenCounts, model: dict[str, Any], visible_output: int
) -> tuple[Range, str, str | None]:
    """How many thinking tokens to charge, and whether we are guessing."""
    if isinstance(tokens.thinking, int) and not isinstance(tokens.thinking, bool):
        return exact(float(tokens.thinking)), "reported", None
    if tokens.thinking is None and model.get("reasoning"):
        ratio = to_range(model.get("thinkingRatio"))
        if ratio is not None:
            return (
                Range(0.0, visible_output * ratio.central, visible_output * ratio.high),
                "estimated",
                "thinking-unknown",
            )
        # The model can think, we have no ratio, and we refuse to invent one.
        return exact(0.0), "unknown-model", "thinking-unknown"
    return ZERO, "not-applicable", None


def _collect_sources(
    row: dict[str, Any], parent: dict[str, Any] | None, region: dict[str, Any]
) -> list[dict[str, Any]]:
    sources = [row["source"]]
    if parent is not None and parent["source"]["url"] != row["source"]["url"]:
        sources.append(parent["source"])
    sources.append(region["source"])
    water_source = region.get("waterSource")
    if water_source and water_source["url"] != region["source"]["url"]:
        sources.append(water_source)
    return sources


def estimate(
    event: UsageEvent,
    dataset: dict[str, Any],
    region_code: str | None = None,
    water_scope: str = "on-site + off-site",
    carbon_basis: str = "location-based",
    include_embodied: bool = True,
    at: str | None = None,
) -> Estimate:
    calibration = dataset["calibration"]
    at = at or event.timestamp[:10]
    flags: list[str] = []

    requested = region_code or event.region_hint
    region = get_region(dataset, requested)
    if region is None:
        region = get_region(dataset, dataset["defaultRegion"])
        flags.append("region-default")
    if region is None:
        raise RuntimeError(f"Dataset has no default region \"{dataset['defaultRegion']}\"")
    resolved_region = region["code"]

    model = resolve_model(event.model_raw, dataset)
    if model is None:
        return _unknown(
            event, dataset["version"], resolved_region, [*flags, "model-unknown"], "unknown-model"
        )

    row = select_benchmark(model, dataset, at=at, hosting=event.hosting)
    if row is None:
        return _unknown(
            event,
            dataset["version"],
            resolved_region,
            [*flags, "no-benchmark"],
            "unknown-model",
            model["id"],
        )
    if event.hosting == "local" and row["pue"]["high"] > 1:
        flags.append("local-row-missing")

    parent = (
        next((r for r in dataset["benchmarks"] if r["id"] == row.get("proxyOf")), None)
        if row.get("proxyOf")
        else None
    )

    if event.tokens.estimated:
        flags.append("tokens-estimated")

    # ------------------------------------------------------------- tokens

    visible_output = (event.tokens.output or 0) + (event.tokens.tool or 0)
    thinking_range, thinking_handling, thinking_flag = _thinking_for(
        event.tokens, model, event.tokens.output or 0
    )
    if thinking_flag:
        flags.append(thinking_flag)
    output_tokens = order(add(exact(float(visible_output)), thinking_range))

    hidden = to_range(calibration["hiddenContextFactor"].get(event.surface)) or exact(1.0)
    if hidden.high > 1:
        flags.append("input-partial")
    if (
        event.tokens.input is None
        and event.tokens.output is not None
        and "input-partial" not in flags
    ):
        flags.append("input-partial")

    counted_input = float(event.tokens.input or 0)
    cached_read = float(event.tokens.cached_read or 0)
    cached_write = float(event.tokens.cached_write or 0)

    cache_share = to_range(calibration["cachedReadShareOfInput"])
    write_share = to_range(calibration["cacheWriteShareOfInput"])
    input_tokens = order(
        add(
            add(mul(exact(counted_input), hidden), scale(cache_share, cached_read)),
            scale(write_share, cached_write),
        )
    )

    # ------------------------------------------------------------- energy

    rates = normalize_to_per_token(row, dataset, model)
    energy_wh: Range | None = None
    if rates is not None:
        for flag in rates.flags:
            if flag not in flags:
                flags.append(flag)
        raw = add(
            add(rates.intercept_wh, mul(rates.input_wh, input_tokens)),
            mul(rates.output_wh, output_tokens),
        )
        with_overhead = raw if row["energyIncludesPue"] else mul(raw, to_range(row["pue"]))
        energy_wh = clamp_non_negative(order(with_overhead))
    else:
        flags.append("no-energy-figure")

    energy_kwh = scale(energy_wh, 1 / 1000) if energy_wh is not None else None

    def direct_scale() -> Range:
        per_prompt = row.get("perPrompt")
        if not per_prompt:
            return exact(1.0)
        k = float(calibration["outputToInputEnergyWeight"]["central"])
        reference = (
            float(per_prompt["referenceInputTokens"]["central"])
            + k * float(per_prompt["referenceOutputTokens"]["central"])
        )
        if reference <= 0:
            return exact(1.0)
        work = order(
            Range(
                input_tokens.low + k * output_tokens.low,
                input_tokens.central + k * output_tokens.central,
                input_tokens.high + k * output_tokens.high,
            )
        )
        return scale(work, 1 / reference)

    def embodied_uplift() -> Range | None:
        share = to_range(row.get("embodiedShareOfTotal"))
        if share is None or water_scope != "lifecycle" or not include_embodied:
            return None
        return Range(
            1 / max(1e-9, 1 - share.low),
            1 / max(1e-9, 1 - share.central),
            1 / max(1e-9, 1 - share.high),
        )

    # -------------------------------------------------------------- water

    water_ml: Range | None = None
    direct_water = to_range((row.get("perPrompt") or {}).get("directWaterMl"))
    if direct_water is not None:
        water_ml = clamp_non_negative(order(mul(direct_water, direct_scale())))
        if "scaled-direct-figure" not in flags:
            flags.append("scaled-direct-figure")
    elif energy_kwh is not None:
        onsite = to_range(row.get("waterOnsiteLPerKwh")) or ZERO
        litres = mul(energy_kwh, onsite)
        if water_scope != "on-site":
            litres = add(litres, mul(energy_kwh, to_range(region["waterOffsiteLPerKwh"])))
        water_ml = clamp_non_negative(order(scale(litres, 1000)))
        uplift = embodied_uplift()
        if uplift is not None:
            water_ml = order(mul(water_ml, uplift))

    # ------------------------------------------------------------- carbon

    carbon_g: Range | None = None
    direct_carbon = to_range((row.get("perPrompt") or {}).get("directCarbonG"))
    if direct_carbon is not None:
        carbon_g = clamp_non_negative(order(mul(direct_carbon, direct_scale())))
        if "scaled-direct-figure" not in flags:
            flags.append("scaled-direct-figure")
    elif energy_kwh is not None:
        # Location-based by default. A market-based factor is a claim about what
        # the provider bought, not about the electrons it burned.
        row_intensity = to_range(row.get("carbonGPerKwh"))
        intensity = (
            row_intensity
            if carbon_basis == "provider-reported" and row_intensity is not None
            else to_range(region["gridGco2PerKwh"])
        )
        carbon_g = clamp_non_negative(order(mul(energy_kwh, intensity)))
        uplift = embodied_uplift()
        if uplift is not None:
            carbon_g = order(mul(carbon_g, uplift))

    return Estimate(
        event_id=event.id,
        model_id=model["id"],
        dataset_version=dataset["version"],
        energy_wh=energy_wh,
        water_ml=water_ml,
        carbon_g=carbon_g,
        benchmark_row_id=row["id"],
        benchmark_parent_id=parent["id"] if parent else None,
        methodology=row["methodology"],
        boundary=row["boundary"],
        region_code=resolved_region,
        thinking_handling=thinking_handling,
        thinking_tokens=None if thinking_handling == "not-applicable" else thinking_range,
        water_scope=water_scope,
        carbon_basis=carbon_basis,
        quality_score=row["qualityScore"],
        flags=flags,
        sources=_collect_sources(row, parent, region),
    )
