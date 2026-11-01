---
name: betteruseofai-methodology
description: How the energy, water and carbon figures in this plugin are worked out, where each number comes from, and what we do not know. Use when someone asks what a figure means, why it is a range, why two sources disagree, or whether a figure can be quoted.
---

# How the figures are worked out

Read this before quoting any number from this plugin, and before answering a question about what
one means.

## Everything is a range, and that is not hedging

Published measurements of language model inference disagree by an order of magnitude. Google
reports a median Gemini Apps text prompt at 0.24 Wh and 0.26 mL of water. Mistral's life-cycle
assessment of a 400-token Le Chat reply reports 45 mL. Both are correct. They are counting
different things.

So every figure carries a low, a central and a high value, and the interface shows all three. A
single number would be a claim we cannot support.

## The four boundaries

| Boundary | What it counts |
|---|---|
| `accelerator-only` | The chip, and nothing else. Google's narrow figure of 0.10 Wh |
| `server` | The chip plus its host. Most independent benchmarks stop here |
| `datacenter` | Adds cooling, idle draw and facility overhead. Google's 0.24 Wh |
| `lifecycle` | Adds manufacturing, training and the water used generating the electricity. Mistral's 45 mL |

When two figures disagree, check the boundary before anything else. It is usually the whole
explanation.

## What each flag means

- **`thinking-unknown`** The model thinks before it answers and did not say how much. The range
  runs from no thinking at the low to a lot at the high, with the central at a measured ratio, so
  describe it as a range that allows for hidden thinking, not as a floor. Claude Code turns never
  carry it: Anthropic's output count already holds the thinking, so a turn
  with no split still has nothing missing. Nor do rows whose measurement ran the model's reasoning,
  such as o3, because the thinking is already inside their rate.
- **`proxy-row`** Nobody has measured this model, so the figure is scaled from one that has been.
  Anthropic has published no per-query figures at all, so every current Claude model is scaled from
  a measurement of Claude 3.7 Sonnet. Quality is capped at 2 of 5 for these.
- **`derived-rate`** The source published one figure for one exchange, and we split it into a rate
  per token. The range is widened to say so.
- **`input-partial`** The app hides its system prompt, so the counted input is a lower bound.
- **`attachments-uncounted`** An image or file went with the prompt and the extension couldn't read
  it, so the input is a lower bound for that reason too.
- **`region-default`** No region was given, so the world average grid was used.
- **`embodied-missing`** The lifecycle scope was asked for and nobody has published what making the
  hardware adds for this model. Water and carbon are lower bounds and render with the "greater than
  or equal to" marker. Energy is unaffected.
- **`direct-scope-wider`** The source published water or carbon only at a wider scope than the one
  asked for, as Mistral did with its life cycle figures. The narrower part can't be taken out of a
  published total, so it reads "unknown".
- **`model-unknown`** We do not recognise the model. There are no numbers at all, and the figure
  reads "unknown". It is never zero. A total that leaves such turns out renders with the "greater
  than or equal to" marker, and so does one that leaves out a turn with no energy figure
  (`no-energy-figure`, energy only) or no water figure (`no-water-figure`, water only).

The "greater than or equal to" marker means something known is missing from the figure. That is
all it means; undisclosed thinking doesn't carry it, because its range already spans it.

## The rule that matters most

Absence never renders as zero. An unrecognised model reads "unknown". An undisclosed thinking count
gives a range starting at zero with a flag, not a silent omission. A turn we could not price is
counted separately and left out of the total rather than folded in as nothing.

If you are ever unsure whether to show a figure or say you do not know, say you do not know.

## Carbon: location-based by default

The default is the location-based grid factor for the region. A provider's market-based factor is a
claim about what it bought, not about the electrons it burned, and it flatters the result: Google's
market-based 94 gCO2e per kWh against its own location-based 345. The market-based figure is
available, but only when the reader asks for it.

## What we do not know

- Nobody publishes what a cache hit costs. The low bound assumes free, the high bound assumes half
  an input token.
- The tokenizer ratios for Anthropic and Google have not been measured against the providers' own
  counting endpoints.
- Off-site water comes from the World Resources Institute's national factors, and Singapore and
  South Africa have none of their own yet. The hourly grid range is real only for the regions the
  gridcarbon snapshot covers.
- The parametric formula for open models has a unit convention that is not fully pinned down. A
  measured row always wins over it.

Run `node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" models --all` for the model table, what
measures each one, and how good that measurement is.

## Scale

Agentic sessions dwarf chat prompts. A single chat prompt is a fraction of a watt hour. A coding
session running hundreds of turns reaches kilowatt hours, and re-reading the cached context usually
dominates: over a fortnight of the author's own sessions, cache reads came to 2.2 billion tokens
against 121 million written and far fewer typed.
When someone asks what their usage costs, per session is the honest unit, not per prompt.
