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

- **`thinking-unknown`** The model thinks before it answers and did not say how much. The figure is
  a lower bound and renders with a "greater than or equal to" marker. Never describe it as a total.
- **`proxy-row`** Nobody has measured this model, so the figure is scaled from one that has been.
  Anthropic has published no per-query figures at all, so every current Claude model is scaled from
  a measurement of Claude 3.7 Sonnet. Quality is capped at 2 of 5 for these.
- **`derived-rate`** The source published one figure for one exchange, and we split it into a rate
  per token. The range is widened to say so.
- **`input-partial`** The app hides its system prompt, so the counted input is a lower bound.
- **`region-default`** No region was given, so the world average grid was used.
- **`model-unknown`** We do not recognise the model. There are no numbers at all, and the figure
  reads "unknown". It is never zero.

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
- Most region grid intensities in the dataset still need re-fetching from the Ember dataset, and
  every region currently shares one off-site water range built around a United States figure.
- The parametric formula for open models has a unit convention that is not fully pinned down. A
  measured row always wins over it.

Run `node "${CLAUDE_PLUGIN_ROOT}/dist/betteruseofai.mjs" models --all` for the model table, what
measures each one, and how good that measurement is.

## Scale

Agentic sessions dwarf chat prompts. A single chat prompt is a fraction of a watt hour. A coding
session running hundreds of turns reaches kilowatt hours, and cache writes usually dominate: one
turn in the author's own logs produced 134 output tokens and carried a 351,000 token cache write.
When someone asks what their usage costs, per session is the honest unit, not per prompt.
