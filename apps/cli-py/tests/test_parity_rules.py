"""Tests for the Python tool.

These mirror the TypeScript tests rather than duplicating the parity harness.
The harness proves the two agree; these prove the rules hold in this half, so a
failure here says which rule broke rather than only that the two differ.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from betteruseofai.aggregate import aggregate, equivalents
from betteruseofai.canonical import canonical_json, canonical_number, strip_generated_with
from betteruseofai.cli import parse_args, resolve_since, run
from betteruseofai.engine import (
    downgrade_target,
    fit_query_set,
    load_dataset,
    resolve_model,
    select_benchmark,
)
from betteruseofai.estimate import TokenCounts, UsageEvent, estimate

REPO = Path(__file__).resolve().parents[3]
LOGS = REPO / "fixtures" / "logs"
CLAUDE_DIR = str(LOGS / "claude-code")
NOW = "2026-09-15T12:00:00.000Z"

DATASET = load_dataset()


def cli(*extra: str) -> tuple[str, str, int]:
    return run([*extra, "--now", NOW, "--no-color", "--source", "claude-code", "--dir", CLAUDE_DIR])


def event(**over) -> UsageEvent:
    tokens = over.pop("tokens", None) or TokenCounts(input=1000, output=500)
    return UsageEvent(
        id=over.pop("id", "event-1"),
        surface=over.pop("surface", "api"),
        hosting=over.pop("hosting", "cloud"),
        model_raw=over.pop("model_raw", "claude-opus-5"),
        tokens=tokens,
        timestamp=over.pop("timestamp", "2026-09-01T12:00:00.000Z"),
        **over,
    )


# ------------------------------------------------- the rounding contract


def test_the_rounding_rule_matches_the_committed_fixture():
    cases = json.loads((REPO / "fixtures" / "rounding" / "cases.json").read_text("utf-8"))
    for case in cases:
        assert canonical_number(case["input"]) == case["expected"], case["input"]


def test_canonical_json_sorts_keys_and_ends_with_one_newline():
    assert canonical_json({"b": 1, "a": 0.1 + 0.2}) == '{\n  "a": 0.3,\n  "b": 1\n}\n'


def test_canonical_json_keeps_null_because_null_means_we_do_not_know():
    assert canonical_json({"energyWh": None}) == '{\n  "energyWh": null\n}\n'


def test_strip_removes_only_what_may_differ():
    stripped = strip_generated_with(
        {"header": {"schemaVersion": 1, "generatedWith": "x", "generatedAt": "y"}, "body": 1}
    )
    assert stripped["header"] == {"schemaVersion": 1}
    assert stripped["body"] == 1


# ------------------------------------------- absence never renders as zero


def test_an_unknown_model_gives_nulls_and_a_flag():
    result = estimate(event(model_raw="not-a-model"), DATASET)
    assert result.energy_wh is None
    assert result.water_ml is None
    assert result.carbon_g is None
    assert "model-unknown" in result.flags


def test_a_synthetic_line_never_resolves():
    assert resolve_model("<synthetic>", DATASET) is None


def test_an_undisclosed_thinking_count_starts_at_zero_and_is_flagged():
    result = estimate(event(tokens=TokenCounts(input=1000, output=500, thinking=None)), DATASET)
    assert "thinking-unknown" in result.flags
    assert result.thinking_handling == "estimated"
    assert result.thinking_tokens.low == 0
    assert result.thinking_tokens.central > 0


def test_a_model_that_cannot_think_charges_nothing_and_says_so():
    result = estimate(
        event(model_raw="claude-3.5-sonnet", tokens=TokenCounts(input=100, output=100)), DATASET
    )
    assert result.thinking_handling == "not-applicable"
    assert result.thinking_tokens is None
    assert "thinking-unknown" not in result.flags


def test_a_reported_count_is_used_as_it_stands():
    result = estimate(event(tokens=TokenCounts(input=100, output=100, thinking=1200)), DATASET)
    assert result.thinking_handling == "reported"
    assert result.thinking_tokens.central == 1200


def test_a_cache_hit_may_be_free_at_the_low_bound_and_never_at_the_high_one():
    cached = estimate(
        event(tokens=TokenCounts(input=0, output=100, cached_read=50000, thinking=0)), DATASET
    )
    nothing = estimate(event(tokens=TokenCounts(input=0, output=100, thinking=0)), DATASET)
    assert math.isclose(cached.energy_wh.low, nothing.energy_wh.low, rel_tol=1e-12)
    assert cached.energy_wh.high > nothing.energy_wh.high


def test_a_bucket_of_only_unknowns_has_null_totals_not_zeroes():
    one = event(model_raw="not-a-model")
    rolled = aggregate([(one, estimate(one, DATASET))], "all")[0]
    assert rolled.energy_wh is None
    assert rolled.unknown_model_count == 1


def test_an_unknown_turn_adds_nothing_to_a_total():
    known = event(id="a", tokens=TokenCounts(input=100, output=100, thinking=0))
    unknown = event(id="b", model_raw="not-a-model")
    rolled = aggregate(
        [(known, estimate(known, DATASET)), (unknown, estimate(unknown, DATASET))], "all"
    )[0]
    alone = estimate(known, DATASET)
    assert rolled.count == 2
    assert rolled.unknown_model_count == 1
    assert math.isclose(rolled.energy_wh.central, alone.energy_wh.central, rel_tol=1e-12)


# -------------------------------------------------------- the engine itself


def test_a_fit_never_produces_a_negative_rate():
    for row in DATASET["benchmarks"]:
        if row["shape"] != "per-query-set":
            continue
        intercept, input_wh, output_wh = fit_query_set(row["perQuerySet"]["points"])
        assert intercept >= 0 and input_wh >= 0 and output_wh >= 0, row["id"]


def test_the_measured_row_reproduces_its_published_figure():
    # 100 in, 300 out was published as 0.950 Wh at server level, times a PUE of 1.14.
    result = estimate(
        event(model_raw="claude-3.7-sonnet", tokens=TokenCounts(input=100, output=300, thinking=0)),
        DATASET,
    )
    assert 0.95 < result.energy_wh.central < 1.25


def test_choosing_a_row_is_deterministic():
    for model in DATASET["models"]:
        first = select_benchmark(model, DATASET, at="2026-09-01")
        second = select_benchmark(model, DATASET, at="2026-09-01")
        assert (first or {}).get("id") == (second or {}).get("id")


def test_a_local_model_is_costed_without_data_centre_overhead():
    model = next(m for m in DATASET["models"] if m["id"] == "llama-3.1-8b")
    row = select_benchmark(model, DATASET, at="2026-09-01", hosting="local")
    assert row["id"] == "ecologits.parametric.local"
    assert row["pue"]["high"] == 1


def test_the_ladder_finds_the_next_rung_down_and_stops_at_the_bottom():
    opus = next(m for m in DATASET["models"] if m["id"] == "claude-opus-5")
    haiku = next(m for m in DATASET["models"] if m["id"] == "claude-haiku-4.5")
    assert downgrade_target(opus, DATASET)["id"] == "claude-sonnet-5"
    assert downgrade_target(haiku, DATASET) is None


def test_carbon_follows_the_grid():
    tokens = TokenCounts(input=1000, output=1000, thinking=0)
    turn = event(model_raw="claude-3.7-sonnet", tokens=tokens)
    france = estimate(turn, DATASET, region_code="FR")
    india = estimate(turn, DATASET, region_code="IN")
    assert india.carbon_g.central > france.carbon_g.central * 10


def test_a_directly_published_lifecycle_figure_is_used_as_published():
    result = estimate(
        event(model_raw="mistral-large-2", tokens=TokenCounts(input=200, output=400)), DATASET
    )
    assert result.benchmark_row_id == "mistral.large-2.lca.2025"
    assert result.energy_wh is None
    assert "no-energy-figure" in result.flags
    assert result.water_ml.central > 0


# ------------------------------------------------------------ equivalents


def test_equivalents_return_nothing_rather_than_an_unreadable_fraction():
    assert equivalents(0.0000001, "energy", DATASET) == []
    assert equivalents(None, "energy", DATASET) == []


def test_equivalents_prefer_a_whole_number_of_small_things():
    assert equivalents(43.8, "water", DATASET)[0]["id"] == "teaspoon"


def test_equivalents_scale_up_to_a_week_of_agent_sessions():
    assert equivalents(17180, "energy", DATASET)[0]["id"] == "household-day"
    assert equivalents(56350, "water", DATASET)[0]["id"] == "shower-minute"


def test_the_stale_search_figure_is_a_last_resort():
    assert equivalents(4, "energy", DATASET)[0]["id"] == "phone-charge"


# ------------------------------------------------------------- the tool


def test_arguments_take_a_value_with_a_space_or_an_equals_sign():
    assert parse_args(["summary", "--since", "7d"])["flags"]["since"] == "7d"
    assert parse_args(["summary", "--since=7d"])["flags"]["since"] == "7d"


def test_an_unknown_option_is_refused_rather_than_ignored():
    assert "No such option" in parse_args(["summary", "--sicne", "7d"])["errors"][0]


def test_a_relative_window_resolves_against_the_injected_clock():
    from datetime import datetime, timezone

    now = datetime(2026, 9, 15, 12, 0, 0, tzinfo=timezone.utc)
    assert resolve_since("7d", now) == "2026-09-08T12:00:00.000Z"
    assert resolve_since("24h", now) == "2026-09-14T12:00:00.000Z"


def test_summary_names_what_it_could_not_price():
    out, _err, code = cli("summary")
    assert code == 0
    assert "1 of 8 turns used a model we do not recognise" in out
    assert "not in the figures above" in out


def test_export_writes_an_empty_cell_for_an_unknown_figure():
    out, _err, _code = cli("export", "--format", "csv")
    rows = out.split("\n")
    header = rows[0].split(",")
    unknown = next(row for row in rows if "claude-opus-42" in row)
    cells = unknown.split(",")
    for column in ("energy_wh_central", "water_ml_central", "carbon_g_central"):
        assert cells[header.index(column)] == "", column


def test_a_bad_region_says_how_to_find_a_good_one():
    _out, err, code = cli("summary", "--region", "ZZ")
    assert code == 2
    assert "models --all" in err


def test_the_output_follows_the_copy_rules():
    texts = [
        run([])[0],
        cli("summary")[0],
        cli("doctor")[0],
        cli("session", "session-alpha")[0],
    ]
    for text in texts:
        assert "–" not in text and "—" not in text
        assert "!" not in text
        for banned in ("delve", "leverage", "seamless", "robust", "empower"):
            assert banned not in text.lower()
        assert "Get started" not in text
        assert "Learn more" not in text


@pytest.mark.parametrize("command", ["summary", "sessions", "export", "models", "doctor"])
def test_every_command_produces_canonical_json(command: str):
    out, _err, code = cli(command, "--json")
    assert code == 0
    parsed = json.loads(out)
    assert parsed["header"]["schemaVersion"] == 1
    # Re-serialising through the canonical writer must give back the same bytes.
    assert canonical_json(parsed) == out + "\n"


# --------------------------------------------------- the vendored dataset


def test_the_vendored_dataset_is_the_one_in_the_repository():
    """The Python package ships its own copy of the dataset, so it can drift.

    This recomputes the hash straight from the source files, which needs no
    build step, and compares it to what the vendored bundle claims. If someone
    edits a data file and forgets to run the sync script, the two tools would
    ship different numbers and this says so.
    """
    import hashlib

    files = ("models", "benchmarks", "regions", "equivalents", "calibration")
    data_dir = REPO / "packages" / "dataset" / "data"

    digest = hashlib.sha256()
    for name in files:
        raw = (data_dir / f"{name}.json").read_text(encoding="utf-8").replace("\r\n", "\n")
        digest.update((name + "\n").encode("utf-8"))
        digest.update(raw.encode("utf-8"))

    assert digest.hexdigest() == DATASET["sha256"], (
        "The vendored dataset is out of date. Run: python scripts/sync-dataset.py"
    )
