# Motion

> Working document. Written 2026-09-13. Every figure below was measured on the machine this was
> written on, over the loopback address, unless it says otherwise.

## The stance

A page that argues for using less computation has to justify every frame it draws. The rule this
project settled on: motion is allowed where it is the argument, for as long as it is making the
argument, and then it stops. Decoration does not qualify. Nothing loops except a caret.

So the landing backdrop plays once. Reduced motion, the Still toggle and a machine without WebGL2
all get the frame the sequence ends on, drawn once and held. Components move for a fifth of a
second or less and only in opacity and small transforms. The footer of every page prints what the
page weighs.

## The landing backdrop

| | |
|---|---|
| Purpose | The brand's argument, visibly: four things from the ground becoming four things built on them, and then the box you type into. |
| Trigger | The band entering the viewport, with a 120 px margin. Leaving the viewport pauses; returning resumes where it left off. A hidden tab stops the clock. |
| Duration | 27.2 s, once. Four pairs of 6.8 s (1.5 s hold, 2.6 s dissolve, 1.7 s hold, 1.0 s connective move), the last connective move landing on the composer. Then held for as long as the page is open. |
| Easing | Smoothstep on every mix. Disorder, the dither churn, peaks at the middle of a dissolve on a sine. |
| Scroll | The stage swells from a backdrop behind the headline to full bleed and back with scroll position, read in a passive listener and written as one custom property. After the clock stops, scrolling still shapes the stage and draws nothing. |
| Reduced motion | The composer frame, drawn once and held. The stage does not swell. The caret stands. |
| Still toggle | Same as reduced motion, chosen by the reader and remembered in `localStorage` under `buai-still`. |
| No WebGL2 | The composer frame, drawn once in JavaScript by the canvas 2D renderer, and nothing else. |
| Cost | Script 6.3 kB gzipped (15.3 kB raw). Eight field renders at load, a few milliseconds. Per frame, one full-screen WebGL2 draw at about one fragment per five CSS pixels on `powerPreference: low-power`, for at most 27 s. Measured while running: 95th percentile frame gap 16.7 ms, which is 60 frames a second. Largest contentful paint on the landing page 164 ms. Whole page 138 kB over the wire. |
| Where | `apps/site/src/islands/dither/`, `apps/site/src/styles/global.css`, `apps/site/src/components/DitherField.astro` |

Per-frame work on the main thread is one custom property write and one draw call. The caption's
position is fixed and only its opacity follows the swell; it used to ride the fade line, which was
a layout pass per frame for one line of text. The mask that fades the field is repainted as the
swell changes, which is paint and not layout, and is the one cost the swell cannot avoid.

## The caret

| | |
|---|---|
| Purpose | Marks the composer as a box somebody types into, once the sequence has ended there. |
| Trigger | The stage gaining `data-ended`. |
| Duration | 1.1 s, two steps, repeating. |
| Easing | `steps(2, jump-none)`. |
| Reduced motion and Still | Stands rather than blinks. |
| Cost | A CSS opacity animation on one small element, on the compositor. |

## Components

| Component | What moves | Duration | Easing | Reduced motion |
|---|---|---|---|---|
| Buttons | Background colour on hover | 120 ms | `cubic-bezier(0.2, 0, 0.1, 1)` | Instant |
| Redacted | Colour and background on reveal | 200 ms | same | Instant |
| Caption | Opacity with the swell | 320 ms | same | None |
| Composer hint | Enters at 4 px below and fades in | 200 ms | same | No entrance, appears in place |
| Everything else | Nothing | | | |

Under `prefers-reduced-motion: reduce` the tokens set every tempo to zero and `components.css`
clamps every animation and transition to a millisecond. Range bars, readouts, tables, the FAQ and
the dashboard's rings and bars do not move at all.

## The dashboard rings

Static, by decision. The brief pictured a saving accreting in motion. A saving is earned over days,
and a picture that finishes growing in two seconds would say otherwise. The rings are one per
recorded day, drawn once from the data, and a day with nothing saved still draws thin.

## The terminal

Nothing moves. A status line is one line, a block meter is ten characters, and both are printed
once.

## Budgets, and what enforces them

| Budget | Enforced by | Measured |
|---|---|---|
| Landing script at most 25 kB gzipped | `apps/site/tests/site.test.ts` | 8.5 kB |
| Landing page at most 250 kB over the wire | `apps/site/tests/site.test.ts` | 138 kB |
| Fonts at most 130 kB | `packages/tokens/scripts/copy-fonts.mjs` and the site test | 116 kB |
| Largest contentful paint under 2.0 s, 95th percentile frame gap under 34 ms | `apps/site/tests/site.test.ts`, printed on every run and failing only with `BUAI_PERF_STRICT=1` | 164 ms, 16.7 ms |

The brief allowed 60 kB of script and 400 kB of page. The plan's tighter figures are the ones the
tests hold, because the page fits inside them with room and a budget you are not near is not doing
anything.
