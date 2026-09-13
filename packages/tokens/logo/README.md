# The mark

> At the three-directions gate, 2026-09-13. Nothing here is chosen. `build.mjs` draws the three
> and the sheet; `../scripts/shoot-logo.mjs` screenshots the sheet in both themes.

## The three directions

Each is one form that reads two ways, drawn by hand as monoline SVG on a sixteen unit box with a
1.5 unit stroke. The toolbar icon is the drawing; every larger size is the same drawing scaled.

| | Direction | The two readings | 16 px | Terminal |
|---|---|---|---|---|
| A | The wafer, `svg/a-wafer.svg` | A ripple where a drop landed, tree rings, and a silicon wafer with its flat edge | Two rings and a point; the flat reads | `◎` or `(o)` |
| B | The die, `svg/b-die.svg` | A die with one corner drawn to a leaf tip; the midrib's veins leave at right angles, so venation is routing | The outline holds; the veins crowd, and would need thinning if this is chosen | `◩` or `[/]` |
| C | The delta, `svg/c-delta.svg` | A river reaching the sea, and fan-out from a single pin, with the same turns | Clean; the risk is that it reads as the Greek letter psi first | `ʸ` or `\|/` |

`sheet.html`, and its two screenshots, show each at 16, 24, 32, 48, 64 and 128, on both Chrome
toolbar tones in the mid-tone and the accent, inside a circular crop, on the accent, and beside
the wordmark.

## What the chosen one gets

- Exports at 16, 32, 48 and 128 for the extension manifest, written by a small PNG encoder in this
  script with no dependency, and an SVG favicon for the site.
- A toolbar colour: `--muted` (`#5a655e`), which reads on Chrome's light and dark toolbars alike,
  and `theme_icons` for Firefox with ink and paper variants.
- The avatar export with a two unit margin, `svg/*-avatar.svg`, so a circular crop clears every
  stroke.
- Horizontal and stacked lockups with the Big Shoulders wordmark, monochrome and reversed through
  `currentColor`, and this document extended with the grid, clear space and minimum sizes.

## Superseded

`superseded/` holds the three cell-grid routes of 2026-09-12 and the script that drew them. They
put the dither mechanism at eight cells and read as texture rather than as a mark.
