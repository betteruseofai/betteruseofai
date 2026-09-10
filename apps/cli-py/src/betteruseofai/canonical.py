"""Canonical JSON, and the number rounding that makes it match the TypeScript tool.

The four rules, which the TypeScript side in packages/core/src/format.ts follows
too, exist because the two languages do not agree on their own:

  1. Round to six significant digits with the language's own correctly rounded
     decimal conversion: ``%.6g`` here, ``toPrecision`` there.
  2. Print the shortest form that round trips. ``repr`` gives that here.
  3. Drop a trailing ``.0``, which Python adds to every float and JavaScript
     does not.
  4. Strip leading zeros from the exponent, keeping its sign. Python writes
     ``1e-09`` where JavaScript writes ``1e-9``.

Object keys are sorted, the indent is two spaces, every break is a line feed,
and there is exactly one trailing newline. ``None`` is kept, because it means
"we do not know" and dropping it would turn absence into silence.
"""

from __future__ import annotations

import json
import math
import re
from typing import Any

SCHEMA_VERSION = 1
SIGNIFICANT_DIGITS = 6

_EXPONENT = re.compile(r"e([+-])0+(\d)")


def round_significant(value: float, digits: int = SIGNIFICANT_DIGITS) -> float:
    """Round to a number of significant digits, leaving zero and infinities alone."""
    if not math.isfinite(value) or value == 0:
        return value
    return float(f"%.{digits}g" % value)


def canonical_number(value: float, digits: int = SIGNIFICANT_DIGITS) -> str:
    """The canonical decimal string for a number."""
    if isinstance(value, bool):  # bool is an int in Python, and must not land here
        raise TypeError("canonical_number was given a boolean")
    if isinstance(value, float) and math.isnan(value):
        return "NaN"
    if isinstance(value, float) and math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"
    if value == 0:
        return "0"
    text = repr(round_significant(float(value), digits))
    if text.endswith(".0"):
        text = text[:-2]
    return _EXPONENT.sub(r"e\1\2", text)


def _write(value: Any, indent: str) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return canonical_number(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)

    if isinstance(value, (list, tuple)):
        if not value:
            return "[]"
        inner = indent + "  "
        items = [f"{inner}{_write(item, inner)}" for item in value]
        return "[\n" + ",\n".join(items) + f"\n{indent}]"

    if isinstance(value, dict):
        entries = sorted(
            ((key, item) for key, item in value.items() if item is not _UNSET),
            key=lambda pair: pair[0],
        )
        if not entries:
            return "{}"
        inner = indent + "  "
        parts = [
            f"{inner}{json.dumps(key, ensure_ascii=False)}: {_write(item, inner)}"
            for key, item in entries
        ]
        return "{\n" + ",\n".join(parts) + f"\n{indent}}}"

    return "null"


class _Unset:
    """Stands in for JavaScript's undefined: a field that does not apply, and is dropped."""

    def __repr__(self) -> str:  # pragma: no cover - debugging only
        return "UNSET"


_UNSET = _Unset()
UNSET = _UNSET


def canonical_json(value: Any) -> str:
    return _write(value, "") + "\n"


def strip_generated_with(payload: dict[str, Any]) -> dict[str, Any]:
    """Remove the only fields the two implementations are allowed to differ on."""
    copy = dict(payload)
    header = copy.get("header")
    if isinstance(header, dict):
        clean = dict(header)
        clean.pop("generatedWith", None)
        clean.pop("generatedAt", None)
        copy["header"] = clean
    return copy
