# The mark

> Chosen on 2026-09-13: direction B, the die. `build.mjs` draws it, `export.mjs` renders every file
> that uses it, and `../scripts/shoot-logo.mjs` screenshots the sheet in both themes.

## What it is

A square with two opposite corners chamfered, so the outline is a die seen from above and a leaf
seen from the side, pointed at the tip and at the stem. Inside, a midrib runs from stem to tip and
four veins leave it. A vein at forty-five degrees to a diagonal midrib is a vertical or a
horizontal line, so the veins are drawn as exactly that: leaf venation and orthogonal routing in
the same strokes. Read the square first and it is a floorplan. Read the point first and it is a
leaf. That dual read is the whole brand, and the mark is the smallest statement of it.

## The drawing

Sixteen units square, 1.5 unit stroke, round caps and joins, `currentColor`.

```
outline   M2.5 5.5 V13.5 H10.5 L13.5 10.5 V2.5 H5.5 Z
midrib    M3.5 12.5 L12.5 3.5
veins up  M5.5 10.5 V6.5     M8 8 V4.5
veins out M5.5 10.5 H9.5     M8 8 H11.5
```

Every horizontal and vertical stroke sits on a half unit, so at 16 px its 1.5 px width covers
whole pixels on one side and antialiases on the other, which is as crisp as a 1.5 px stroke gets.
The 16 px icon is the drawing; every larger size is the same drawing scaled. There is no separate
small version and none is needed.

## Files

| File | What it is for |
|---|---|
| `svg/b-die.svg` | The mark. `currentColor`, so it is ink on paper, paper on ink, or the accent, wherever it is placed |
| `svg/b-die-avatar.svg` | The mark with a two unit margin, for anything that crops to a circle |
| `svg/lockup-horizontal.svg`, `svg/lockup-stacked.svg` | Mark and wordmark, the wordmark as text in Big Shoulders 800. Right wherever the font is available; a condensed sans elsewhere |
| `png/lockup-horizontal-ink.png`, `-paper.png`, and the stacked pair | The lockups at 2x for the README and other places an SVG cannot load a font |
| `png/mark-128.png`, `png/avatar-460.png` | The mark alone, and the avatar on the ground for GitHub |
| `apps/extension/public/icon/{16,32,48,128}.png` | Chrome's toolbar icon, in the toolbar tone |
| `apps/extension/public/icon/{size}-ink.png`, `-paper.png` | Firefox `theme_icons`, ink for a light toolbar and paper for a dark one |
| `apps/site/public/favicon.svg` | Follows the browser's colour scheme |
| `apps/site/public/favicon-32.png`, `apple-touch-icon.png` | For browsers without SVG favicons, and for a home screen, ink on the ground |

Run `pnpm --filter @betteruseofai/tokens logo` to regenerate all of them from the SVG.

## Colour

The mark inherits the ink of whatever it sits on, and on the site it does. Where it cannot inherit,
it uses one of these:

| Where | Colour | Why |
|---|---|---|
| Chrome toolbar | `--icon-toolbar`, `#717c75` | A manifest icon is a fixed image with no way to know which toolbar it is on. This tone clears 3 to 1 on Chrome's light toolbar (3.90), its dark toolbar (3.71), and both of our grounds (3.68, 4.27). The tokens test asserts it |
| Firefox toolbar | ink `#14201a` or paper `#e6e3dc` | Firefox can be told, through `theme_icons` |
| Favicon | ink, paper under `prefers-color-scheme: dark` | The tab strip follows the system, and so does the favicon |
| Home screen | ink on the ground `#eeece9` | A home screen gives it no background of ours |
| On the accent | paper | Buttons and the accent tile |

Never the hazard colour, never a gradient, never a fill inside the outline.

## Clear space and minimum sizes

Leave half the mark's width clear on every side. In a lockup the wordmark sits one mark-width
away, its cap height matching the mark's height, in Big Shoulders 800, uppercase, with 0.5 units
of tracking.

| Use | Minimum |
|---|---|
| Toolbar, favicon | 16 px, and nothing smaller exists |
| Beside text, as in the site's navigation | 1.15 em of the text, never below 18 px |
| Alone | 24 px |
| Avatar | The `-avatar` file, so a circle clears every stroke |

## In the terminal

`◩` where a glyph is wanted, `[/]` under `--ascii`. Neither is the mark; they stand in for it.

## Do and do not

- Do let the mark inherit the ink around it. Do not recolour it to make a point.
- Do use the avatar file for a circle. Do not crop the plain mark.
- Do scale the drawing. Do not redraw it thinner for small sizes; the stroke is the drawing.
- Do keep the wordmark uppercase in the display face. Do not set it in the body face or the mono.
- Do not add a leaf, a chip or a plug beside it. It already is both.

## Superseded

`superseded/` holds the three cell-grid routes of 2026-09-12 and the script that drew them, and the
sheet still shows directions A and C as drawn for the choice.
