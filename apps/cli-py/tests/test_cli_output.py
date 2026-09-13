"""The text the tool prints, on the two rules the audit added.

The parity harness compares the two tools byte for byte, so most of what the
Python side prints is checked there. These are the two things the harness
cannot see: the colour switch, which depends on the environment, and the
shape of the brief report.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest import mock

from betteruseofai.cli import run

REPO = Path(__file__).resolve().parents[3]
CLAUDE_DIR = REPO / "fixtures" / "logs" / "claude-code"
NOW = "2026-09-15T12:00:00.000Z"


def cli(*extra: str) -> tuple[str, str, int]:
    return run([*extra, "--now", NOW, "--no-color", "--source", "claude-code", "--dir", str(CLAUDE_DIR)])


def test_brief_is_six_lines_or_fewer_and_counts_the_caveats() -> None:
    stdout, _, code = cli("session", "session-alpha", "--brief")
    assert code == 0
    assert len(stdout.split("\n")) <= 6
    assert 'caveats. Run "betteruseofai session session-alpha"' in stdout
    assert "% of the energy" in stdout
    assert "[ " in stdout


def test_brief_falls_back_to_ascii() -> None:
    stdout, _, _ = cli("session", "session-alpha", "--brief", "--ascii")
    assert "#" in stdout
    assert "▓" not in stdout
    assert "≥" not in stdout


def test_no_color_switches_colour_off_whatever_the_value() -> None:
    from betteruseofai.cli import Context, parse_args

    with mock.patch.object(sys.stdout, "isatty", return_value=True):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("NO_COLOR", None)
            assert Context(parse_args(["summary"])).colour is True
        with mock.patch.dict(os.environ, {"NO_COLOR": "1"}):
            assert Context(parse_args(["summary"])).colour is False
        with mock.patch.dict(os.environ, {"NO_COLOR": "yes please"}):
            assert Context(parse_args(["summary"])).colour is False


def test_every_equivalent_names_its_quantity() -> None:
    stdout, _, _ = cli("summary")
    assert "energy: about " in stdout
    assert "carbon: about " in stdout
