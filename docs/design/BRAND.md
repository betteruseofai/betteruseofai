# Brand

> Working document. Written 2026-09-13 from the audit in `CONFLICTS.md` and the decisions taken on
> it. The mark was chosen the same day; see the last section.

## The idea

Nature and silicon share a single geometry. Quartz sand becomes a wafer, a river becomes a coolant
loop, soil horizons become the layers of a die, roots become fibre. The identity is the dual read:
a form that is one thing and the other at once, and lets the eye flip between them. A leaf beside a
chip is the failure case. A field of dots that is a canopy from one distance and a rack from
another is the whole brand.

The mechanism that makes that possible everywhere is ordered dither. An eight by eight Bayer tile
turns any density into whole cells, so a tree and a server are drawn from the same grid and the
same ink. The landing backdrop, the mark and the paper grid all use that tile. It is the one motif
that carries across the site, the extension and the terminal, where it becomes block characters.

The register is an instrument panel, not a launch page. Slightly cold, a little dystopian, never
breathless. The reference points are brikken.co and daoism.systems.

## Palette

One hue. The brief spoke of quartz and sand, wafer iridescence, pine and moss, deep water and one
warm tone. This is how those words map onto the tokens, and what is deliberately absent.

| The brief's word | Token | Light | Dark | Role |
|---|---|---|---|---|
| Quartz, sand | `--bg`, `--bg-raised`, `--bg-sunken` | `#eeece9`, `#f6f5f2`, `#e4e1dc` | `#121412`, `#1a1d1a`, `#0c0e0c` | Ground, panels, troughs |
| Pine | `--accent`, `--accent-strong` | `#0f6b3a`, `#0a5c31` | `#3ddc84`, `#6fe3a0` | Links, buttons, the central mark on every readout, focus |
| Moss | `--accent-tint` | `#d3e3d8` | `#183824` | Selected rows, the lower band of a range bar |
| The warm tone | `--hazard` | `#9a4b00` | `#f5a524` | The upper band's hatching, caveats, the draft banner |
| | `--danger` | `#a3251c` | `#ff6b61` | Errors only |
| Ink | `--ink`, `--ink-2`, `--muted` | `#14201a`, `#1b2a21`, `#5a655e` | `#e6e3dc`, `#d9d6cf`, `#9aa39d` | Headlines, body, labels |
| | `--hairline`, `--border-ui` | `#cfcbc4`, `#6b756f` | `#2a2f2b`, `#8f9892` | Grid rules and the dither field; input borders |

**Deep water is not a colour here.** A second hue would make the readouts a two-colour system where
the eye has to learn which colour means what. The system encodes state by hatching and position so
that colour never carries meaning alone. **Iridescence is not a gradient here.** It is expressed as
ordered dither in the ink colour, which the backdrop and the mark already do. Colour gradients are
ruled out by test; the hatching, the paper grid and the landing scrim are structure and legibility,
named in `tokens.json` by file and count.

Every pair that carries text, both themes, measured on 2026-09-12 and asserted by
`packages/tokens/test/contrast.test.ts`:

| Pair | Light | Dark |
|---|---|---|
| ink on bg | 14.23 | 14.44 |
| ink-2 on bg | 12.72 | 12.75 |
| muted on bg | 5.15 | 7.14 |
| accent on bg | 5.59 | 10.37 |
| accent-strong on bg | 6.88 | 11.61 |
| hazard on bg | 5.27 | 9.07 |
| danger on bg | 6.27 | 6.64 |
| muted on bg-sunken | 4.66 | 7.47 |
| muted on accent-tint | 4.55 | 4.97 |
| ink on accent-tint | 12.59 | 10.05 |
| bg on accent, the button | 5.59 | 10.37 |
| border-ui on bg, non-text | 4.05 | 6.24 |
| ink-2 over a filled dither cell | 9.28 | 9.40 |

Two colours may not sit over the dither field in the light theme, and the test says so: muted at
3.76 and accent at 4.08 over a filled cell. Body copy that shares a stage with the field is `--ink-2`.

## Type

| Face | Weights shipped | Where |
|---|---|---|
| Big Shoulders | 800 | Statement headlines and the brand, uppercase, line height 0.9 |
| Schibsted Grotesk | 400, 400 italic, 700 | Body |
| IBM Plex Mono | 400, 500 | Every number, unit, label, button, caption and metastrip, with `tabular-nums slashed-zero` |

Six static instances, 116 kB, latin subset, self hosted, licensed under the SIL Open Font License
(see `FONTS.md`). No font stack falls back to Inter, and a test checks that.

The scale is fluid from 320 to 1440 px, `--step--2` (about 11 px) to `--step-5` (3.5 to 8.5 rem).
Every size is a token; nothing is set in pixels in a component.

## Shape

Hard corners, `--radius: 0`, asserted by test. Hairlines, not shadows. Sections divide with a rule.
The paper grid is visible on the landing, method and calculator pages, twelve columns of hairline.
No cards, no centred hero, no three of anything in a row.

## Motion

Short, or once. Components move at 120, 200 or 320 ms with one ease, in opacity and in transforms
of a few pixels. The landing backdrop is the one long sequence, it plays once, and its rules are in
`MOTION.md`. Nothing loops except a caret. Reduced motion holds a designed still, and the Still
toggle at the top of every page holds the same one and remembers.

## Copy

British English, first person plural for the project, present tense. Sentences average under
twenty words. Concrete sourced numbers over adjectives; every number in published copy sits beside
a source chip. Absence renders as "unknown", never as nought. The full rules are in
`docs/STYLE.md` and the voice they serve in `docs/VOICE.md`; Vale and `copy-lint` enforce them.

## Surfaces, and the boundary between them

The website and the extension share `tokens.css`, `components.css` and the class names in them,
and nothing else. The site is Astro with one Preact island; the extension is Preact under Manifest
v3, which forbids inline script and remote code. They cannot share a runtime and should not: the
backdrop is a WebGL shader a landing page can carry and a 360 px popup must never start. The
composer hint lives inside other people's pages in a shadow root, carries its palette generated from
`tokens.json`, and styles itself through an adopted stylesheet because a host page's policy blocks
an inline style element (probed in `apps/extension/test/e2e.test.ts`).

The terminal is its own surface. Figures in green, caveats in yellow, labels dim, one bold heading,
never red against green, and the codes come from the same `tokens.json`. Under `NO_COLOR`,
`--no-color` or a pipe none of them are written. One block meter, for a share of a whole; ranges
stay as text, because a bar of a range with a hidden floor invites reading the bar as the value.

## Do and do not

- Do draw one form that reads two ways. Do not put a natural thing beside a built thing.
- Do use the eight-cell dither tile for texture. Do not use a colour gradient for anything.
- Do set every number in the mono face with its range and its source. Do not round a missing value
  to nought, and do not print a figure without a chip.
- Do use `--hazard` for the uncertain end and for caveats. Do not use it as a brand colour.
- Do let the type be the picture. Do not add an image, an icon set or an emoji.
- Do make the still frame first. Do not ship a stopped animation as the still.

## The mark

The die. A square with two opposite corners chamfered, so the outline is a die from above and a
leaf from the side; inside, a midrib and four veins that are vertical and horizontal lines, so leaf
venation and orthogonal routing are the same strokes. Drawn once at sixteen units with a 1.5 unit
stroke in `currentColor`, and every size is that drawing scaled. Chosen on 2026-09-13 from three
shape directions after the cell-grid routes of the day before were set aside.
`packages/tokens/logo/README.md` carries the drawing, the files, the colours it uses where it
cannot inherit one (the Chrome toolbar tone `#717c75` clears 3 to 1 on both toolbar colours),
clear space, minimum sizes and the do-and-do-not list. It sits beside the wordmark in the site's
navigation, in the browser tab, on the toolbar, and at the top of the README.
