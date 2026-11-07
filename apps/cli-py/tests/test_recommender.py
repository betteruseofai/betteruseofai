"""The recommender, checked against the same cases the TypeScript uses."""

from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from betteruseofai.engine import load_dataset
from betteruseofai.estimate import TokenCounts
from betteruseofai.recommender import (
    create_recommender,
    extract_features,
    read_arithmetic,
    read_unit_conversion,
)

REPO = Path(__file__).resolve().parents[3]
DATASET = load_dataset()

CASES = [
    json.loads(line)
    for line in (REPO / "fixtures" / "recommender" / "cases.jsonl")
    .read_text(encoding="utf-8")
    .split("\n")
    if line.strip()
]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_shared_cases(case: dict):
    recommender = create_recommender(
        DATASET, has_local_model=bool(case.get("hasLocalModel"))
    )
    got = recommender.recommend(
        case["prompt"],
        model_id=case.get("modelId") or "claude-opus-5",
        conversation_depth=case.get("conversationDepth", 0),
    )
    wanted = case["expect"]
    why = case.get("why", "")

    if "kind" in wanted:
        assert got.kind == wanted["kind"], why
    if "ruleId" in wanted:
        assert got.rule_id == wanted["ruleId"], why
    if "answer" in wanted:
        assert got.answer == wanted["answer"], why
    for veto in wanted.get("vetoedBy", []):
        assert veto in got.vetoed_by, why
    if "showAsHint" in wanted:
        assert got.show_as_hint == wanted["showAsHint"], why
    if "showInReport" in wanted:
        assert got.show_in_report == wanted["showInReport"], why
    if "confidence" in wanted:
        assert got.confidence == wanted["confidence"], why
    if "explanationContains" in wanted:
        assert wanted["explanationContains"] in got.explanation, why


def test_the_arithmetic_reader_never_evaluates_what_it_was_given():
    # If this were eval, any of these would run. They must all come back None.
    for attack in (
        "__import__('os').system('echo no')",
        "1 + open('/etc/passwd').read()",
        "exec('x=1')",
        "1 + 1; print(2)",
        "().__class__.__bases__",
    ):
        assert read_arithmetic(attack) is None, attack


def test_the_arithmetic_reader_refuses_what_it_cannot_finish():
    assert read_arithmetic("5 / 0") is None
    assert read_arithmetic("5 +") is None
    assert read_arithmetic("(5 + 3") is None
    assert read_arithmetic("5 5") is None
    assert read_arithmetic("1" + "+1" * 200) is None


def test_the_arithmetic_reader_reads_the_sums_people_type():
    assert read_arithmetic("17*23").answer == "391"
    assert read_arithmetic("what is 100 - 37").answer == "63"
    assert read_arithmetic("(2 + 3) * 4").answer == "20"
    assert read_arithmetic("-5 + 12").answer == "7"
    assert read_arithmetic("10 % 3").answer == "1"


def test_the_unit_reader_converts_only_within_one_quantity():
    assert read_unit_conversion("5 km in miles").answer == "3.106856 miles"
    assert read_unit_conversion("5 km in kilograms") is None
    assert read_unit_conversion("5 parsecs in bananas") is None


def test_the_unit_reader_reads_one_well_formed_number_or_nothing():
    assert read_unit_conversion("1.2.3 km to m") is None
    assert read_unit_conversion("1,500 m in km").answer == "1.5 km"


def test_the_arithmetic_reader_leaves_dates_and_telephone_numbers_alone():
    assert read_arithmetic("2026-10-19") is None
    assert read_arithmetic("19/10/2026") is None
    assert read_arithmetic("020-7946-0018") is None
    assert read_arithmetic("1.2.3 + 4") is None
    assert read_arithmetic("0.5 + 0.25").answer == "0.75"


def test_answers_print_the_way_javascript_prints_them():
    # The same strings are asserted in the TypeScript tests.
    assert read_arithmetic("123456789 * 987654321").answer == "121932631112635260"
    assert read_arithmetic("1 / 30000").answer == "0.00003333333333"
    assert read_arithmetic("99999999999 * 99999999999").answer == "9.9999999998e+21"


def test_the_opening_verb_counts_only_as_a_whole_word():
    assert extract_features("listen to this").imperative_verb is None
    assert extract_features("tagline for a bakery").imperative_verb is None
    assert extract_features("list the planets").imperative_verb == "list"
    assert extract_features("Please fix the grammar here").imperative_verb == "fix the grammar"
    assert extract_features("Summarise: the notes").imperative_verb == "summarise"


def test_it_names_the_parts_of_a_program_a_prompt_talks_about():
    assert extract_features("extract the parser into its own module").code_nouns == [
        "parser",
        "module",
    ]
    assert extract_features("rewrite the film script").code_nouns == []


def test_words_and_characters_are_counted_the_way_javascript_counts_them():
    assert extract_features("one\x1ctwo").words == 1
    assert extract_features("one﻿two").words == 2
    assert abs(extract_features("\U0001f600a").non_latin_share - 2 / 3) < 1e-12
    assert extract_features("\U0001f600a").chars == 3
    assert extract_features("٣. one").constraint_count == 0


SWAP = "Rewrite this sentence so it is shorter."


def test_the_swap_is_priced_on_a_real_turn_when_there_is_one():
    recommender = create_recommender(DATASET)
    guessed = recommender.recommend(SWAP, model_id="claude-opus-5", at="2026-11-07")
    real = recommender.recommend(
        SWAP,
        model_id="claude-opus-5",
        at="2026-11-07",
        turn=TokenCounts(
            input=2000,
            cached_read=150000,
            output=800,
            thinking=None,
            thinking_in_output=True,
        ),
    )
    small = guessed.estimated_savings.energy_wh.central
    assert small > 0
    assert real.estimated_savings.energy_wh.central > small * 10


def test_the_swap_is_priced_on_the_region_it_is_given():
    france = create_recommender(DATASET, region_code="FR").recommend(
        SWAP, model_id="claude-opus-5", at="2026-11-07"
    )
    india = create_recommender(DATASET, region_code="IN").recommend(
        SWAP, model_id="claude-opus-5", at="2026-11-07"
    )
    assert france.estimated_savings.energy_wh == india.estimated_savings.energy_wh
    assert france.estimated_savings.carbon_g.central < india.estimated_savings.carbon_g.central / 2


def test_the_swap_is_priced_on_the_date_it_is_given():
    # No row was published by 2000, so there is nothing to price it with.
    got = create_recommender(DATASET).recommend(SWAP, model_id="claude-opus-5", at="2000-01-01")
    assert got.kind == "downgrade"
    assert got.estimated_savings is None


def test_features_finish_inside_the_budget():
    prompt = "Rewrite this paragraph so it reads more plainly. " * 40
    started = time.perf_counter()
    for _ in range(100):
        extract_features(prompt)
    each_ms = (time.perf_counter() - started) / 100 * 1000
    assert each_ms < 2


def test_a_longer_cue_swallows_a_shorter_one_it_contains():
    cues = extract_features("explain why this happens").reasoning_cues
    assert "explain why" in cues
    assert "why" not in cues


def test_it_never_names_a_swap_it_cannot_make():
    got = create_recommender(DATASET).recommend(
        "What is the capital of Australia", model_id="claude-haiku-4.5"
    )
    assert got.target is None
    assert got.kind == "keep"


def test_it_never_reports_a_negative_saving():
    recommender = create_recommender(DATASET)
    for model in DATASET["models"]:
        got = recommender.recommend(
            "Rewrite this sentence so it is shorter.", model_id=model["id"]
        )
        if got.estimated_savings is None:
            continue
        for value in (
            got.estimated_savings.energy_wh,
            got.estimated_savings.water_ml,
            got.estimated_savings.carbon_g,
        ):
            if value is None:
                continue
            assert value.low >= 0, model["id"]
            assert value.central >= 0, model["id"]


def test_it_can_be_muted_a_rule_at_a_time():
    quiet = create_recommender(DATASET, muted=["downgrade.rewrite-task"])
    got = quiet.recommend("Rewrite this sentence so it is shorter.", model_id="claude-opus-5")
    assert got.rule_id != "downgrade.rewrite-task"


def test_everything_it_says_follows_the_copy_rules():
    recommender = create_recommender(DATASET, has_local_model=True)
    for case in CASES:
        got = recommender.recommend(case["prompt"], model_id="claude-opus-5")
        assert "–" not in got.explanation
        assert "—" not in got.explanation
        assert "!" not in got.explanation
