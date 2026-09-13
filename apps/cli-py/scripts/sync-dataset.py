"""Copy the built dataset into the Python package and check it is the same one.

The two tools must ship the same numbers, so the hash inside the bundle is
recomputed here and compared. A mismatch is a build failure rather than a
warning, because two tools quietly disagreeing about the numbers is the worst
outcome this project has.

The hash is over the raw bytes of the source files, in a fixed order, with line
endings normalised. Hashing a re-serialisation would be fragile: JavaScript
writes 1.17e-6 where Python writes 1.17e-06, so the two languages would compute
different hashes for identical data. That mismatch is exactly what this check
caught when it was first written.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

FILES = ("models", "benchmarks", "regions", "equivalents", "calibration")

here = Path(__file__).resolve().parent
repo = here.parent.parent.parent
dataset_dir = repo / "packages" / "dataset"
source = dataset_dir / "dist" / "dataset.json"
target = here.parent / "src" / "betteruseofai" / "data" / "dataset.json"
tokens_source = repo / "packages" / "tokens" / "tokens.json"
tokens_target = here.parent / "src" / "betteruseofai" / "data" / "tokens.json"

if not source.exists():
    sys.exit(f"No built dataset at {source}. Run: pnpm --filter @betteruseofai/dataset build")

bundle = json.loads(source.read_text(encoding="utf-8"))

digest = hashlib.sha256()
for name in FILES:
    raw = (dataset_dir / "data" / f"{name}.json").read_text(encoding="utf-8").replace("\r\n", "\n")
    digest.update((name + "\n").encode("utf-8"))
    digest.update(raw.encode("utf-8"))
recomputed = digest.hexdigest()

if recomputed != bundle["sha256"]:
    sys.exit(
        "The dataset hash does not match what the TypeScript build recorded.\n"
        f"  bundle:     {bundle['sha256']}\n"
        f"  recomputed: {recomputed}\n"
        "The two tools would ship different numbers, so this is a build failure."
    )

target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target)
print(f"dataset {bundle['version']} ({bundle['sha256'][:12]}) copied into the python package")

# The design tokens travel the same way, for the terminal block: the escape
# codes and meter glyphs both tools print come from one file.
shutil.copyfile(tokens_source, tokens_target)
print("tokens.json copied into the python package")
