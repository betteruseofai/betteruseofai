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
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from .engine import Range, downgrade_target, get_model, order, resolve_model
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
    code_nouns: list[str] = field(default_factory=list)
    reasoning_cues: list[str] = field(default_factory=list)
    constraint_count: int = 0
    question_count: int = 0
    conversation_depth: int = 0
    non_latin_share: float = 0.0


# The two languages disagree on what whitespace is, what a digit is and where
# a line ends, so this file spells out JavaScript's answers and uses them.
# JavaScript's \s and String.prototype.trim, as a character class.
_S = "[\t\n\v\f\r    -     　﻿]"
_TRIM = re.compile(f"^{_S}+|{_S}+\\Z")
_SPLIT = re.compile(f"{_S}+")
# JavaScript's . and the m flag's ^ and $ treat all four of these as line ends.
_LINE_ENDS = re.compile("[\r  ]")
_A = re.ASCII  # \d, \w, \b and case folding as JavaScript has them


def _js_trim(text: str) -> str:
    return _TRIM.sub("", text)


def _utf16_length(text: str) -> int:
    """String length as JavaScript counts it, in UTF-16 code units."""
    return len(text.encode("utf-16-le")) // 2


def _js_number(value: float) -> str:
    """Number.prototype.toString, which repr and str do not match past 1e16 or below 1e-4."""
    if value == 0:
        return "0"
    sign = "-" if value < 0 else ""
    digits_tuple, exponent = Decimal(repr(abs(value))).normalize().as_tuple()[1:]
    digits = "".join(str(d) for d in digits_tuple)
    k = len(digits)
    n = k + int(exponent)  # value = 0.digits x 10^n
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    power = n - 1
    mark = "+" if power >= 0 else "-"
    mantissa = digits if k == 1 else digits[0] + "." + digits[1:]
    return f"{sign}{mantissa}e{mark}{abs(power)}"


def _format_answer(value: float) -> str:
    """Write an answer the way a person would, matching the TypeScript exactly."""
    if math.isfinite(value) and value == math.floor(value):
        return _js_number(value)
    return _js_number(float(f"{value:.10g}"))


def _evaluate_expression(text: str) -> float | None:
    """A tiny recursive descent parser over numbers, brackets and + - * / %."""
    source = _SPLIT.sub("", text)
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
        text = source[start:index]
        # "1.2.3" is not a number, in either language.
        if not _NUMBER.match(text):
            return None
        return float(text)

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


_NUMBER = re.compile(r"(?:\d+\.?\d*|\.\d+)\Z", _A)

_ARITHMETIC = re.compile(
    rf"^(?:what(?:'s| is)|calculate|compute|work out|how much is)?{_S}*"
    rf"([0-9()+\-*/%.\t\n\v\f\r    -     　﻿]"
    rf"{{3,120}}?){_S}*(?:=|\?)?\Z",
    re.IGNORECASE | _A,
)

# Digits and dashes that are not a sum: a date, a telephone number, a code.
_DATE_LIKE = re.compile(r"^\d+([-/])\d+(?:\1\d+)+\Z", _A)
_LEADING_ZERO = re.compile(r"(?:^|[^\d.])0\d", _A)


def read_arithmetic(prompt: str) -> Arithmetic | None:
    text = _js_trim(prompt)
    if not re.search(r"[0-9]", text) or not re.search(r"[+\-*/%]", text):
        return None
    match = _ARITHMETIC.match(text)
    if not match:
        return None
    expression = _js_trim(match.group(1))
    if not re.search(r"[+\-*/%]", expression):
        return None
    # "2026-10-19" is a date, not 1997. "100-37" with one dash is still a sum.
    if _DATE_LIKE.match(expression) or _LEADING_ZERO.search(expression):
        return None
    value = _evaluate_expression(expression)
    if value is None:
        return None
    return Arithmetic(_SPLIT.sub(" ", expression), _format_answer(value))


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

# One well-formed number, and not the tail of a longer one: "1.2.3 km" is nothing.
_CONVERSION = re.compile(
    r"(?<![\d.,])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?![\d.,])"
    rf"{_S}*([a-z]+){_S}*(?:in|to|into|as){_S}+([a-z]+)",
    re.IGNORECASE | _A,
)


def read_unit_conversion(prompt: str) -> UnitConversion | None:
    match = _CONVERSION.search(_js_trim(prompt))
    if not match:
        return None
    value = float(match.group(1).replace(",", ""))
    from_unit = match.group(2).lower()
    to_unit = match.group(3).lower()

    source = _UNITS.get(from_unit)
    target = _UNITS.get(to_unit)
    if source is None or target is None or source[0] != target[0]:
        return None

    converted = float("%.8g" % (value * source[1] / target[1]))
    return UnitConversion(value, from_unit, to_unit, f"{_format_answer(converted)} {to_unit}")


_CODE_SIGNALS = [
    re.compile(p.replace(r"\s", _S), flags | _A) for p, flags in [
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

# A whole word at the start, so "listen" is not "list" and "tagline" is not "tag".
_IMPERATIVE_PATTERNS = [
    (verb, re.compile(f"^(?:please{_S}+)?{verb}(?![a-z])", _A)) for verb in _IMPERATIVES
]

# Words that name parts of a program. Words with an everyday sense ("file",
# "script", "branch", "test", "class") are left out on purpose.
_CODE_NOUNS = re.compile(
    r"\b(?:functions?|methods?|modules?|parsers?|tests|(?:unit|failing) tests?|bugs?|repos?"
    r"|repository|codebase|commits?|endpoints?|components?|variables?|compiler|linter"
    r"|stack trace|regex|schema|migrations?|pull request|api|dependency|dependencies"
    r"|exceptions?|git|type errors?|source code|the code)\b",
    _A,
)

_REASONING_CUES = (
    "why", "prove", "derive", "explain how", "explain why", "work out",
    "trade-off", "tradeoff", "compare", "design", "architect", "debug",
    "root cause", "step by step", "reason about", "implications", "strategy",
    "edge case", "race condition", "optimise", "optimize", "refactor",
)  # fmt: skip

_DATE_MATH = re.compile(
    r"\b(?:how many (?:days|weeks|months|years)|days? (?:between|until|since|from now)"
    r"|what day (?:is|was)|add \d+ days)\b",
    re.IGNORECASE | _A,
)

_BULLET = re.compile(rf"^{_S}*(?:[-*•]|\d+[.)]){_S}+", re.MULTILINE | _A)
_JOIN = re.compile(r"\b(?:and also|as well as|then also|additionally)\b", _A)
_NON_LATIN = re.compile(f"(?!{_S})[^\\x00-ɏ]")


def extract_features(prompt: str, conversation_depth: int = 0) -> Features:
    prompt = prompt or ""
    trimmed = _js_trim(prompt)
    words = len(_SPLIT.split(trimmed)) if trimmed else 0
    lines = len(trimmed.split("\n")) if trimmed else 0

    # JavaScript ends a line at \r,   and   too, for . and for ^ and
    # $ under the m flag. Python ends one only at \n.
    lined = _LINE_ENDS.sub("\n", prompt)

    has_code_fence = "```" in prompt
    hits = sum(1 for pattern in _CODE_SIGNALS if pattern.search(lined))
    code_likelihood = min(1.0, hits / 3)

    lower = trimmed.lower()
    imperative_verb = next(
        (verb for verb, pattern in _IMPERATIVE_PATTERNS if pattern.match(lower)), None
    )
    code_nouns = list(dict.fromkeys(_CODE_NOUNS.findall(lower)))
    # A longer cue swallows a shorter one it contains, so "explain why" does not
    # also count as "why". Without this the confidence climbs on one phrase and
    # the explanation reads as a list of near-duplicates.
    all_cues = [cue for cue in _REASONING_CUES if cue in lower]
    reasoning_cues = [
        cue for cue in all_cues if not any(other != cue and cue in other for other in all_cues)
    ]

    constraint_count = len(_BULLET.findall(lined)) + len(_JOIN.findall(lower))
    question_count = prompt.count("?")
    # Counted in UTF-16 code units on both sides, as JavaScript counts them.
    non_latin = sum(_utf16_length(found) for found in _NON_LATIN.findall(prompt))
    length = _utf16_length(prompt)

    return Features(
        words=words,
        chars=_utf16_length(trimmed),
        lines=lines,
        code_likelihood=code_likelihood,
        has_code_fence=has_code_fence,
        arithmetic=read_arithmetic(trimmed),
        unit_conversion=read_unit_conversion(trimmed),
        date_math=bool(_DATE_MATH.search(trimmed)),
        imperative_verb=imperative_verb,
        code_nouns=code_nouns,
        reasoning_cues=reasoning_cues,
        constraint_count=constraint_count,
        question_count=question_count,
        conversation_depth=conversation_depth,
        non_latin_share=0.0 if not prompt else non_latin / length,
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


def _code_work_rule(ctx: RuleContext) -> RuleResult | None:
    f = ctx.features
    if not f.code_nouns:
        return None
    # "Extract the parser into its own module" and "correct the failing tests"
    # open like small tasks and are changes to a program.
    named = " and ".join(f.code_nouns[:2])
    return RuleResult("keep.code-work", "keep", 0.75, [f"the prompt is about code: {named}"])


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
    Rule("keep.code-work", 1, "keep", _code_work_rule),
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
    # Bound by bound, because both sides are priced from the same rows.
    return order(
        Range(
            max(0.0, before.low - after.low),
            max(0.0, before.central - after.central),
            max(0.0, before.high - after.high),
        )
    )


def _alone_on_ladder(model: dict[str, Any], dataset: dict[str, Any]) -> bool:
    """True when no other current model shares this one's ladder."""
    return not any(
        other["id"] != model["id"]
        and other["family"] == model["family"]
        and other.get("deprecated") is None
        for other in dataset["models"]
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


@dataclass
class _Pricing:
    """The person's settings, so a swap is priced the way their own figures are."""

    region_code: str | None = None
    water_scope: str = "on-site + off-site"
    carbon_basis: str = "location-based"


def _price_swap(
    words: int,
    surface: str,
    from_model: dict[str, Any],
    to_model: dict[str, Any],
    dataset: dict[str, Any],
    pricing: _Pricing,
    expected_output_tokens: int | None = None,
    turn: TokenCounts | None = None,
    at: str | None = None,
) -> Savings | None:
    # Priced on a real turn when the caller has one, otherwise on a guess from
    # the prompt's length. Both sides take the same counts: moving model part
    # way through a session also starts its cache again, a one-off cost this
    # leaves out.
    input_tokens = max(1, round(words * 1.4))
    output_tokens = expected_output_tokens or max(50, input_tokens * 3)
    tokens = turn or TokenCounts(
        input=input_tokens,
        output=output_tokens,
        thinking=None,
        estimated=True,
        estimator="words",
    )
    timestamp = at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def shape(model_id: str) -> UsageEvent:
        return UsageEvent(
            id="recommendation",
            surface=surface,
            hosting="cloud",
            model_raw=model_id,
            model_id=model_id,
            tokens=tokens,
            timestamp=timestamp,
        )

    def priced(model_id: str) -> Any:
        return estimate(
            shape(model_id),
            dataset,
            region_code=pricing.region_code,
            water_scope=pricing.water_scope,
            carbon_basis=pricing.carbon_basis,
            at=timestamp[:10],
        )

    before = priced(from_model["id"])
    after = priced(to_model["id"])
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
        region_code: str | None = None,
        water_scope: str = "on-site + off-site",
        carbon_basis: str = "location-based",
    ) -> None:
        blocked = set(muted or [])
        self.rules = [r for r in [*DEFAULT_RULES, *(rules or [])] if r.id not in blocked]
        self.dataset = dataset
        self.has_local_model = has_local_model
        self.hint_threshold = hint_threshold
        self.report_threshold = report_threshold
        self.pricing = _Pricing(region_code, water_scope, carbon_basis)

    def recommend(
        self,
        prompt: str,
        model_id: str | None = None,
        model_raw: str | None = None,
        surface: str = "api",
        conversation_depth: int = 0,
        expected_output_tokens: int | None = None,
        turn: TokenCounts | None = None,
        at: str | None = None,
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
        # A no-llm suggestion with no answer is only advice, and a veto holds it.
        suggestions = [
            (rule, res)
            for rule, res in fired
            if res.kind != "keep" and ((res.kind == "no-llm" and res.answer) or not blocking)
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

        # A downgrade with nowhere to go is not a downgrade. A model alone on
        # its ladder is not the smallest of anything, so it gets its own sentence.
        if winner.kind == "downgrade" and model and target is None:
            return _nothing(
                f"We don't know a smaller model on the same ladder as {model['displayName']}."
                if _alone_on_ladder(model, self.dataset)
                else f"{model['displayName']} is already the smallest model we know on its ladder."
            )

        savings = (
            _price_swap(
                features.words,
                surface,
                model,
                target,
                self.dataset,
                self.pricing,
                expected_output_tokens,
                turn,
                at,
            )
            if target and model
            else None
        )

        # A smaller model is not always a lighter one: a mini model on a high
        # reasoning budget can cost more than the model above it. If ours prices
        # the swap at no saving, the suggestion would be advice to use more.
        lighter = (
            (savings.energy_wh if savings.energy_wh is not None else savings.carbon_g)
            if savings is not None
            else None
        )
        if (
            winner.kind == "downgrade"
            and target
            and model
            and lighter is not None
            and lighter.central <= 0
        ):
            return _nothing(
                f"{target['displayName']} would not be lighter than {model['displayName']} here, "
                "so there is nothing to suggest."
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
