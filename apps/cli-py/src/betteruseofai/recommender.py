"""The rule based recommender, mirroring packages/core/src/recommender.

Two things this file will not do. It never evaluates a string the user typed:
the arithmetic reader is a hand written grammar over numbers and five
operators. And it never suggests a swap it cannot name, or a tool the user has
not said they have.

Every result carries the rule that produced it and what that rule saw, because
advice nobody can argue with is advice nobody trusts.
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .engine import Range, downgrade_target, get_model, resolve_model
from .estimate import TokenCounts, UsageEvent, estimate

DEFAULT_HINT_THRESHOLD = 0.6
DEFAULT_REPORT_THRESHOLD = 0.45
# A veto this confident stops a downgrade or a local suggestion.
VETO_THRESHOLD = 0.7


# ---------------------------------------------------------------- features


@dataclass
class Arithmetic:
    expression: str
    answer: str


@dataclass
class UnitConversion:
    value: float
    from_unit: str
    to_unit: str
    answer: str | None


@dataclass
class Features:
    words: int = 0
    chars: int = 0
    lines: int = 0
    code_likelihood: float = 0.0
    has_code_fence: bool = False
    arithmetic: Arithmetic | None = None
    unit_conversion: UnitConversion | None = None
    date_math: bool = False
    imperative_verb: str | None = None
    reasoning_cues: list[str] = field(default_factory=list)
    constraint_count: int = 0
    question_count: int = 0
    conversation_depth: int = 0
    non_latin_share: float = 0.0


def _format_answer(value: float) -> str:
    """Write an answer the way a person would, matching the TypeScript exactly."""
    if value == int(value) and abs(value) < 1e15:
        return str(int(value))
    text = repr(float(f"{value:.10g}"))
    return text[:-2] if text.endswith(".0") else text


def _evaluate_expression(text: str) -> float | None:
    """A tiny recursive descent parser over numbers, brackets and + - * / %."""
    source = re.sub(r"\s+", "", text)
    if not source or len(source) > 120:
        return None

    index = 0

    def peek() -> str | None:
        return source[index] if index < len(source) else None

    def number() -> float | None:
        nonlocal index
        start = index
        while index < len(source) and source[index] in "0123456789.":
            index += 1
        if index == start:
            return None
        try:
            return float(source[start:index])
        except ValueError:
            return None

    def factor() -> float | None:
        nonlocal index
        if peek() == "-":
            index += 1
            inner = factor()
            return None if inner is None else -inner
        if peek() == "(":
            index += 1
            inner = expression()
            if peek() != ")":
                return None
            index += 1
            return inner
        return number()

    def term() -> float | None:
        nonlocal index
        left = factor()
        if left is None:
            return None
        while peek() in ("*", "/", "%"):
            operator = peek()
            index += 1
            right = factor()
            if right is None:
                return None
            if operator in ("/", "%") and right == 0:
                return None
            if operator == "*":
                left = left * right
            elif operator == "/":
                left = left / right
            else:
                left = math.fmod(left, right)
        return left

    def expression() -> float | None:
        nonlocal index
        left = term()
        if left is None:
            return None
        while peek() in ("+", "-"):
            operator = peek()
            index += 1
            right = term()
            if right is None:
                return None
            left = left + right if operator == "+" else left - right
        return left

    result = expression()
    if index != len(source) or result is None or not math.isfinite(result):
        return None
    return result


_ARITHMETIC = re.compile(
    r"^(?:what(?:'s| is)|calculate|compute|work out|how much is)?\s*"
    r"([0-9()+\-*/%.\s]{3,120}?)\s*(?:=|\?)?$",
    re.IGNORECASE,
)


def read_arithmetic(prompt: str) -> Arithmetic | None:
    text = prompt.strip()
    if not re.search(r"[0-9]", text) or not re.search(r"[+\-*/%]", text):
        return None
    match = _ARITHMETIC.match(text)
    if not match:
        return None
    expression = match.group(1).strip()
    if not re.search(r"[+\-*/%]", expression):
        return None
    value = _evaluate_expression(expression)
    if value is None:
        return None
    return Arithmetic(re.sub(r"\s+", " ", expression), _format_answer(value))


# Deliberately short. A wrong conversion given confidently is worse than
# sending the question to a model.
_UNITS: dict[str, tuple[str, float]] = {
    "km": ("m", 1000), "m": ("m", 1), "cm": ("m", 0.01), "mm": ("m", 0.001),
    "mile": ("m", 1609.344), "miles": ("m", 1609.344),
    "foot": ("m", 0.3048), "feet": ("m", 0.3048), "ft": ("m", 0.3048),
    "inch": ("m", 0.0254), "inches": ("m", 0.0254),
    "kg": ("g", 1000), "g": ("g", 1),
    "lb": ("g", 453.59237), "lbs": ("g", 453.59237),
    "pound": ("g", 453.59237), "pounds": ("g", 453.59237),
    "oz": ("g", 28.349523125),
    "litre": ("l", 1), "litres": ("l", 1), "liter": ("l", 1), "liters": ("l", 1),
    "l": ("l", 1), "ml": ("l", 0.001),
    "gallon": ("l", 3.785411784), "gallons": ("l", 3.785411784),
}  # fmt: skip

_CONVERSION = re.compile(
    r"(-?[0-9][0-9,.]*)\s*([a-z]+)\s*(?:in|to|into|as)\s+([a-z]+)", re.IGNORECASE
)


def read_unit_conversion(prompt: str) -> UnitConversion | None:
    match = _CONVERSION.search(prompt.strip())
    if not match:
        return None
    try:
        value = float(match.group(1).replace(",", ""))
    except ValueError:
        return None
    from_unit = match.group(2).lower()
    to_unit = match.group(3).lower()

    source = _UNITS.get(from_unit)
    target = _UNITS.get(to_unit)
    if source is None or target is None or source[0] != target[0]:
        return None

    converted = float("%.8g" % (value * source[1] / target[1]))
    return UnitConversion(value, from_unit, to_unit, f"{_format_answer(converted)} {to_unit}")


_CODE_SIGNALS = [
    re.compile(p, flags) for p, flags in [
        (r"```", 0),
        (r"\bfunction\s+\w+\s*\(", 0),
        (r"\b(?:const|let|var)\s+\w+\s*=", 0),
        (r"\bdef\s+\w+\s*\(", 0),
        (r"\bclass\s+\w+", 0),
        (r"\bimport\s+[\w{*]", 0),
        (r"\breturn\b", 0),
        (r"[;{}]\s*$", re.MULTILINE),
        (r"^\s*(?:#include|package |using )", re.MULTILINE),
        (r"\bSELECT\b.+\bFROM\b", re.IGNORECASE),
        (r"=>", 0),
        (r"\$\{", 0),
    ]
]  # fmt: skip

_IMPERATIVES = (
    "rewrite", "reword", "rephrase", "summarise", "summarize", "shorten", "expand",
    "translate", "proofread", "correct", "fix the grammar", "fix grammar", "spellcheck",
    "extract", "classify", "categorise", "categorize", "label", "tag", "list",
    "format", "reformat", "convert", "capitalise", "capitalize", "tidy", "clean up",
)  # fmt: skip

_REASONING_CUES = (
    "why", "prove", "derive", "explain how", "explain why", "work out",
    "trade-off", "tradeoff", "compare", "design", "architect", "debug",
    "root cause", "step by step", "reason about", "implications", "strategy",
    "edge case", "race condition", "optimise", "optimize", "refactor",
)  # fmt: skip

_DATE_MATH = re.compile(
    r"\b(?:how many (?:days|weeks|months|years)|days? (?:between|until|since|from now)"
    r"|what day (?:is|was)|add \d+ days)\b",
    re.IGNORECASE,
)

_BULLET = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+", re.MULTILINE)
_JOIN = re.compile(r"\b(?:and also|as well as|then also|additionally)\b")
_NON_LATIN = re.compile(r"[^\x20-ɏ\s]")


def extract_features(prompt: str, conversation_depth: int = 0) -> Features:
    trimmed = (prompt or "").strip()
    words = len(trimmed.split()) if trimmed else 0
    lines = len(trimmed.split("\n")) if trimmed else 0

    has_code_fence = "```" in prompt
    hits = sum(1 for pattern in _CODE_SIGNALS if pattern.search(prompt))
    code_likelihood = min(1.0, hits / 3)

    lower = trimmed.lower()
    imperative_verb = next(
        (v for v in _IMPERATIVES if lower.startswith(v) or lower.startswith(f"please {v}")), None
    )
    # A longer cue swallows a shorter one it contains, so "explain why" does not
    # also count as "why". Without this the confidence climbs on one phrase and
    # the explanation reads as a list of near-duplicates.
    all_cues = [cue for cue in _REASONING_CUES if cue in lower]
    reasoning_cues = [
        cue for cue in all_cues if not any(other != cue and cue in other for other in all_cues)
    ]

    constraint_count = len(_BULLET.findall(prompt)) + len(_JOIN.findall(lower))
    question_count = prompt.count("?")
    non_latin = len(_NON_LATIN.findall(prompt))

    return Features(
        words=words,
        chars=len(trimmed),
        lines=lines,
        code_likelihood=code_likelihood,
        has_code_fence=has_code_fence,
        arithmetic=read_arithmetic(trimmed),
        unit_conversion=read_unit_conversion(trimmed),
        date_math=bool(_DATE_MATH.search(trimmed)),
        imperative_verb=imperative_verb,
        reasoning_cues=reasoning_cues,
        constraint_count=constraint_count,
        question_count=question_count,
        conversation_depth=conversation_depth,
        non_latin_share=0.0 if not prompt else non_latin / len(prompt),
    )


# ------------------------------------------------------------------- rules


@dataclass
class RuleResult:
    rule_id: str
    kind: str
    confidence: float
    reasons: list[str]
    answer: str | None = None


@dataclass
class RuleContext:
    features: Features
    model: dict[str, Any] | None
    surface: str
    dataset: dict[str, Any]
    has_local_model: bool


@dataclass
class Rule:
    id: str
    version: int
    kind: str
    evaluate: Callable[[RuleContext], RuleResult | None]
    report_only: bool = False


def _looks_like_code(features: Features) -> bool:
    return features.has_code_fence or features.code_likelihood >= 0.34


def _arithmetic_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.arithmetic is None or f.words > 20:
        return None
    return RuleResult(
        "no-llm.arithmetic",
        "no-llm",
        0.95,
        [f"the whole prompt is the sum {f.arithmetic.expression}"],
        f.arithmetic.answer,
    )


def _unit_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.unit_conversion is None or not f.unit_conversion.answer or f.words > 15:
        return None
    return RuleResult(
        "no-llm.unit-conversion",
        "no-llm",
        0.9,
        [f"converts {f.unit_conversion.from_unit} to {f.unit_conversion.to_unit}"],
        f.unit_conversion.answer,
    )


def _date_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if not f.date_math or f.words > 20:
        return None
    # No answer offered: date arithmetic depends on a calendar and a timezone,
    # and a confidently wrong date is worse than no suggestion.
    return RuleResult(
        "no-llm.date-math",
        "no-llm",
        0.8,
        ["asks for date arithmetic, which a calendar does better"],
    )


_REWRITE_VERBS = ("rewrite", "reword", "rephrase", "proofread", "correct", "spellcheck", "tidy")


def _rewrite_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    verb = f.imperative_verb
    if verb is None:
        return None
    if not any(verb.startswith(one) for one in _REWRITE_VERBS) and "grammar" not in verb:
        return None
    if f.words > 400:
        return None
    return RuleResult(
        "downgrade.rewrite-task",
        "downgrade",
        0.8,
        [
            f'starts with "{verb}"',
            f"{f.words} words",
            "some code" if f.code_likelihood > 0 else "no code",
        ],
    )


def _summarise_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.imperative_verb not in ("summarise", "summarize", "shorten"):
        return None
    return RuleResult(
        "downgrade.summarise",
        "downgrade",
        0.75,
        [f'starts with "{f.imperative_verb}"', f"{f.words} words"],
    )


def _translate_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.imperative_verb != "translate":
        return None
    return RuleResult(
        "downgrade.translate", "downgrade", 0.8, ['starts with "translate"', f"{f.words} words"]
    )


_SHAPED = ("extract", "classify", "categorise", "categorize", "label", "tag", "format", "reformat")


def _classify_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.imperative_verb not in _SHAPED:
        return None
    return RuleResult(
        "downgrade.classify-extract",
        "downgrade",
        0.7,
        [f'starts with "{f.imperative_verb}"', "a shaped output task rather than an open one"],
    )


def _short_simple_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.words > 25 or f.words < 3:
        return None
    if _looks_like_code(f) or f.reasoning_cues or f.constraint_count > 0:
        return None
    return RuleResult(
        "downgrade.short-simple",
        "downgrade",
        0.7,
        [f"{f.words} words", "no code", "nothing that needs working out"],
    )


def _no_cues_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.reasoning_cues or f.words > 120 or f.has_code_fence:
        return None
    return RuleResult(
        "downgrade.no-reasoning-cues",
        "downgrade",
        0.55,
        ["nothing in the wording suggests the answer needs working out"],
    )


def _local_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    # Never suggested unless the user has said they run models locally.
    # Telling somebody to use a tool they do not have is not a suggestion.
    if not ctx.has_local_model:
        return None
    if f.words > 60 or f.has_code_fence or f.reasoning_cues:
        return None
    # A genuinely tiny task outranks a downgrade, because running it here
    # removes the data centre entirely where a downgrade only shrinks the model
    # inside it.
    tiny = f.words <= 25 and f.constraint_count == 0
    return RuleResult(
        "local.small-task",
        "local",
        0.75 if tiny else 0.6,
        [
            f"{f.words} words",
            (
                "small enough to run on your own machine instead of in a data centre"
                if tiny
                else "probably small enough for a model on your own machine"
            ),
        ],
    )


def _deep_reasoning_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if not f.reasoning_cues:
        return None
    confidence = min(0.95, 0.6 + 0.15 * len(f.reasoning_cues))
    named = f.reasoning_cues[:3]
    listed = named[0] if len(named) == 1 else f"{', '.join(named[:-1])} and {named[-1]}"
    return RuleResult(
        "keep.deep-reasoning",
        "keep",
        confidence,
        [f"the wording asks for reasoning: {listed}"],
    )


def _long_code_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if not f.has_code_fence and f.code_likelihood < 0.67:
        return None
    if f.words < 40 and not f.has_code_fence:
        return None
    return RuleResult(
        "keep.long-code",
        "keep",
        0.85,
        [
            "contains a code block" if f.has_code_fence else "reads mostly as code",
            f"{f.words} words",
        ],
    )


def _multi_step_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.constraint_count < 3:
        return None
    return RuleResult(
        "keep.multi-step", "keep", 0.8, [f"{f.constraint_count} separate requirements"]
    )


def _deep_conversation_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if f.conversation_depth < 8:
        return None
    # Swapping models part way through a long conversation loses the thread,
    # whatever the next prompt looks like on its own.
    return RuleResult(
        "keep.deep-conversation",
        "keep",
        0.75,
        [f"{f.conversation_depth} turns into this conversation already"],
    )


DEFAULT_RULES: list[Rule] = [
    Rule("no-llm.arithmetic", 1, "no-llm", _arithmetic_rule),
    Rule("no-llm.unit-conversion", 1, "no-llm", _unit_rule),
    Rule("no-llm.date-math", 1, "no-llm", _date_rule),
    Rule("downgrade.rewrite-task", 1, "downgrade", _rewrite_rule),
    Rule("downgrade.summarise", 1, "downgrade", _summarise_rule),
    Rule("downgrade.translate", 1, "downgrade", _translate_rule),
    Rule("downgrade.classify-extract", 1, "downgrade", _classify_rule),
    Rule("downgrade.short-simple", 1, "downgrade", _short_simple_rule),
    Rule("downgrade.no-reasoning-cues", 1, "downgrade", _no_cues_rule, report_only=True),
    Rule("local.small-task", 1, "local", _local_rule),
    Rule("keep.deep-reasoning", 1, "keep", _deep_reasoning_rule),
    Rule("keep.long-code", 1, "keep", _long_code_rule),
    Rule("keep.multi-step", 1, "keep", _multi_step_rule),
    Rule("keep.deep-conversation", 1, "keep", _deep_conversation_rule),
]


# ---------------------------------------------------------- the recommender


@dataclass
class Savings:
    energy_wh: Range | None
    water_ml: Range | None
    carbon_g: Range | None


@dataclass
class Recommendation:
    kind: str
    rule_id: str
    confidence: float
    reasons: list[str]
    target: dict[str, str] | None
    estimated_savings: Savings | None
    vetoed_by: list[str]
    answer: str | None
    explanation: str
    show_as_hint: bool
    show_in_report: bool


def _nothing(reason: str) -> Recommendation:
    return Recommendation(
        kind="keep",
        rule_id="keep.default",
        confidence=0.0,
        reasons=[reason],
        target=None,
        estimated_savings=None,
        vetoed_by=[],
        answer=None,
        explanation=reason,
        show_as_hint=False,
        show_in_report=False,
    )


def _subtract(before: Range | None, after: Range | None) -> Range | None:
    if before is None or after is None:
        return None
    return Range(
        max(0.0, before.low - after.high),
        max(0.0, before.central - after.central),
        max(0.0, before.high - after.low),
    )


def _explain(winner: RuleResult, target: dict[str, Any] | None, vetoed_by: list[str]) -> str:
    seen = "; ".join(winner.reasons)
    if vetoed_by:
        return f"Rule {winner.rule_id} fired ({seen}), but {' and '.join(vetoed_by)} held it back."
    if winner.kind == "no-llm":
        if winner.answer:
            return f"Rule {winner.rule_id} fired: {seen}. The answer is {winner.answer}."
        return f"Rule {winner.rule_id} fired: {seen}."
    if winner.kind == "downgrade":
        if target:
            return (
                f"Rule {winner.rule_id} fired: {seen}. "
                f"{target['displayName']} would probably do."
            )
        return f"Rule {winner.rule_id} fired: {seen}."
    if winner.kind == "local":
        return (
            f"Rule {winner.rule_id} fired: {seen}. "
            "A model on your own machine would probably do."
        )
    return f"Rule {winner.rule_id} fired: {seen}."


def _price_swap(
    words: int,
    surface: str,
    from_model: dict[str, Any],
    to_model: dict[str, Any],
    dataset: dict[str, Any],
    expected_output_tokens: int | None = None,
) -> Savings | None:
    input_tokens = max(1, round(words * 1.4))
    output_tokens = expected_output_tokens or max(50, input_tokens * 3)

    def shape(model_id: str) -> UsageEvent:
        return UsageEvent(
            id="recommendation",
            surface=surface,
            hosting="cloud",
            model_raw=model_id,
            tokens=TokenCounts(
                input=input_tokens,
                output=output_tokens,
                thinking=None,
                estimated=True,
                estimator="words",
            ),
            timestamp="1970-01-01T00:00:00.000Z",
        )

    before = estimate(shape(from_model["id"]), dataset, at="2026-09-10")
    after = estimate(shape(to_model["id"]), dataset, at="2026-09-10")
    if before.energy_wh is None and after.energy_wh is None:
        return None

    return Savings(
        _subtract(before.energy_wh, after.energy_wh),
        _subtract(before.water_ml, after.water_ml),
        _subtract(before.carbon_g, after.carbon_g),
    )


class Recommender:
    def __init__(
        self,
        dataset: dict[str, Any],
        rules: list[Rule] | None = None,
        has_local_model: bool = False,
        hint_threshold: float = DEFAULT_HINT_THRESHOLD,
        report_threshold: float = DEFAULT_REPORT_THRESHOLD,
        muted: list[str] | None = None,
    ) -> None:
        blocked = set(muted or [])
        self.rules = [r for r in [*DEFAULT_RULES, *(rules or [])] if r.id not in blocked]
        self.dataset = dataset
        self.has_local_model = has_local_model
        self.hint_threshold = hint_threshold
        self.report_threshold = report_threshold

    def recommend(
        self,
        prompt: str,
        model_id: str | None = None,
        model_raw: str | None = None,
        surface: str = "api",
        conversation_depth: int = 0,
        expected_output_tokens: int | None = None,
    ) -> Recommendation:
        features = extract_features(prompt, conversation_depth)
        if features.words == 0:
            return _nothing("Nothing to look at yet.")

        model = get_model(model_id, self.dataset) or resolve_model(model_raw, self.dataset)
        context = RuleContext(features, model, surface, self.dataset, self.has_local_model)

        fired = [(rule, rule.evaluate(context)) for rule in self.rules]
        fired = [(rule, res) for rule, res in fired if res is not None]

        vetoes = [(rule, res) for rule, res in fired if res.kind == "keep"]
        blocking = sorted(res.rule_id for _rule, res in vetoes if res.confidence >= VETO_THRESHOLD)

        # A veto blocks a downgrade or a local suggestion, but not an answer we
        # can give outright. If the sum is on the page, the sum is on the page.
        suggestions = [
            (rule, res)
            for rule, res in fired
            if res.kind != "keep" and (res.kind == "no-llm" or not blocking)
        ]
        suggestions.sort(key=lambda pair: (-pair[1].confidence, pair[1].rule_id))

        if not suggestions:
            if blocking:
                held = next((res for _r, res in vetoes if res.rule_id == blocking[0]), None)
                out = _nothing(
                    f"Stay where you are: {'; '.join(held.reasons)}."
                    if held
                    else "Stay where you are."
                )
                out.vetoed_by = blocking
                out.rule_id = blocking[0]
                out.confidence = held.confidence if held else 0.0
                return out
            return _nothing("No rule fired, so no suggestion.")

        rule, winner = suggestions[0]
        target = (
            downgrade_target(model, self.dataset)
            if winner.kind == "downgrade" and model
            else None
        )

        # A downgrade with nowhere to go is not a downgrade.
        if winner.kind == "downgrade" and model and target is None:
            return _nothing(
                f"{model['displayName']} is already the smallest model we know on its ladder."
            )

        savings = (
            _price_swap(
                features.words, surface, model, target, self.dataset, expected_output_tokens
            )
            if target and model
            else None
        )

        return Recommendation(
            kind=winner.kind,
            rule_id=winner.rule_id,
            confidence=winner.confidence,
            reasons=winner.reasons,
            target=({"id": target["id"], "displayName": target["displayName"]} if target else None),
            estimated_savings=savings,
            vetoed_by=blocking,
            answer=winner.answer,
            explanation=_explain(winner, target, blocking),
            show_as_hint=(not rule.report_only) and winner.confidence >= self.hint_threshold,
            show_in_report=winner.confidence >= self.report_threshold,
        )


def create_recommender(dataset: dict[str, Any], **kwargs: Any) -> Recommender:
    return Recommender(dataset, **kwargs)
