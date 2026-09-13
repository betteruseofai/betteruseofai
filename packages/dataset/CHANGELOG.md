# @betteruseofai/dataset

## 0.2.0

Data only, so a minor bump.

- **Regions.** Sixteen grid intensities that had been written from memory of the Ember yearly dataset
  are now read from it: the world average and fifteen countries. Each row's central figure is the
  latest full year, 2025, its range is the spread of the last three years, and its provenance says
  `fetched` with the date. The source URL is the CSV itself rather than the page, which refuses
  automated requests. Several figures moved a long way from what was recalled: the United Kingdom
  from 124 to 217 gCO2/kWh, Canada from 120 to 191, Sweden from 24 to 35. The recalled figures had
  mixed up generation-based and consumption-based intensities for some grids; Ember's are the
  former, power sector CO2 per kWh generated, and the notes on each row say so.
- With Sweden at 35 and India at 710, grids now differ by a factor of about twenty, not thirty. The
  copy that said thirty has been corrected.

Known gaps, in the order they should be closed:

1. The eGRID subregion values for California and Virginia are still marked as recalled and need
   reading out of the EPA spreadsheet.
2. Off-site water needs the per-region factors from the World Resources Institute appendix; every
   region still carries the same range built around the United States figure.
3. Tokenizer ratios for Anthropic and Google need measuring against the providers' counting endpoints.
4. Every proxy row should be replaced by a measurement the moment one is published.

## 0.1.0

First set of rows. Not yet published to npm.

Added, all transcribed from the research appendix in `PLAN.md` on 2026-09-10:

- **Models.** 31 entries across Anthropic, OpenAI, Google, Mistral, Meta, DeepSeek, Alibaba and
  Microsoft, with aliases, ladder positions and thinking ratios. Deliberately incomplete; a model that
  is not here resolves to null and renders as unknown.
- **Benchmarks.** 24 rows. Google's fleet median, the Altman statement, the Mistral life-cycle
  assessment, nine per-query-set rows from Jegham and colleagues, Epoch, the Microsoft Research
  simulation, one Hugging Face Energy Score row, two EcoLogits parametric rows for cloud and local, and
  seven proxy rows covering the current Claude, GPT and Gemini models that nobody has measured.
- **Regions.** 21 entries. The United States from eGRID2023 and India from CEA v21.0 are transcribed
  from the appendix; the other 18 grid intensities were written from memory of the Ember yearly dataset
  and are marked for re-fetch. Off-site water is the weakest part of the file: every region currently
  carries the same range built around the United States figure from Li and colleagues.
- **Equivalents.** 10 comparisons, each sourced, with the 2009 Google search figure marked stale.
- **Calibration.** Tokenizer ratios, cache pricing, the output to input energy weight, and per-surface
  hidden context factors.

Two deviations from the plan, both deliberate:

- `per-prompt` rows can carry `directWaterMl` and `directCarbonG`. Without this the Mistral life-cycle
  row cannot be represented at all, because Mistral published carbon and water per reply but no energy.
- A fifth shape, `proxy`, holds a parent row and a scaling factor rather than duplicating the parent's
  payload.

Known gaps, in the order they should be closed:

1. 18 region grid intensities need re-fetching from the Ember CSV.
2. Off-site water needs the per-region factors from the World Resources Institute appendix.
3. The eGRID subregion values for California and Virginia need reading out of the spreadsheet.
4. Tokenizer ratios for Anthropic and Google need measuring against the providers' counting endpoints.
5. Every proxy row should be replaced by a measurement the moment one is published.
