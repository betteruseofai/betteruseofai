# Toolchain

> Status: draft.

Pinned versions, so CI and this machine agree.

| Tool | Version | How it got here |
|---|---|---|
| Node | 22 for CI and Cloudflare Pages, 24.16 locally | `.node-version` pins 22 |
| pnpm | 10 | `npm install -g pnpm@10`. Corepack needs administrator rights on this machine, so we skipped it |
| uv | 0.12.12 | Official installer, lands in `~/.local/bin` |
| Vale | 3.21.0 | Pinned release binary from errata-ai/vale, in `~/.local/bin` |
| Python | 3.12 and 3.14 | Already present, used from step 5 onwards |

CI installs the same Vale version. If you bump it here, bump it in `.github/workflows/copy.yml` too.

## Parity between the two command line tools

The npm package and the PyPI package must produce the same bytes from the same logs. Run the check
with:

```
pnpm build
python apps/cli-py/scripts/sync-dataset.py
pnpm parity
```

Three things make that possible, and all three were found by trying to do it:

- **The dataset hash covers raw file bytes**, not a re-serialisation. JavaScript writes `1.17e-6`
  where Python writes `1.17e-06`, so hashing a re-serialised copy gave two different hashes for
  identical data. `sync-dataset.py` recomputes the hash and refuses to build if the two disagree.
- **Numbers go through one rounding rule**: six significant digits, shortest round-tripping form, no
  trailing `.0`, no padded exponent. The rule is documented in both implementations and fixed by
  `fixtures/rounding/cases.json`, which was generated on the Python side and is matched by the
  TypeScript.
- **Plain text formatting matches too**, even though the parity check only compares JSON. Python's
  `%g` switches to exponent notation at 1e-5 and JavaScript's `toPrecision` waits until 1e-7, so the
  Python `display_number` does the small-number case by hand.

`fixtures/cli/cases.json` lists what is compared and why. Add a case there when you add a command or
a flag that changes the output.
