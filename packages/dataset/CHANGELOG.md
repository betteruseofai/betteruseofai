# @betteruseofai/dataset

## 1.1.0

Data only, refreshed by the weekly snapshot.

- Great Britain as consumed (NESO) moved to 124 gCO2/kWh (months 94 to 145), twelve months to 2026-08.

## 1.0.0

A schema change, so a major bump: a region row may now carry `rangeSource`, a citation for where
its range came from, beside `source` for the central figure and `waterSource` for the water factor.
The method page shows all three.

- **Regions, the hourly range.** Eleven rows had bands of a fixed few per cent around the central
  figure. They now carry the real hourly spread of 2025 from the gridcarbon snapshot on Zenodo
  (doi 10.5281/zenodo.22299989, CC BY 4.0, 1.46 million hourly values for 45 zones from ENTSO-E,
  EIA-930 and NESO): the 10th and 90th percentiles of the year, taken as a fraction of the year's
  mean and applied to our central figure, so the shape is real and the basis stays ours. The
  snapshot's own levels rest on lifecycle emission factors where Ember's are direct combustion, and
  they are not used. Great Britain, France, Germany, Ireland, the Netherlands, Sweden (four bidding
  zones pooled), Spain, Poland, the United States and California, and Great Britain twice, once per
  source. The spread is wide: a tenth of the
  hours in Sweden sit at about a third of the year's mean and a tenth at more than double it.
  gridcarbon.dev shut its live service on 2026-09-13; the snapshot is the citable copy and will not
  refresh.

Known gaps, in the order they should be closed:

1. Tokenizer ratios for Anthropic and Google need measuring against the providers' counting endpoints.
2. National water factors for Singapore and South Africa, from a source that covers them.
3. Hourly ranges for the regions the snapshot does not cover, from a source that does.
4. Every proxy row should be replaced by a measurement the moment one is published.

## 0.5.0

Data only, refreshed by the weekly snapshot.

- Great Britain as consumed (NESO) added at 124 gCO2/kWh (months 94 to 145), twelve months to 2026-08.
- deprecation dates written for gpt-5 deprecated 2026-06-11.

## 0.4.0

Data only, so a minor bump.

- **Regions, off-site water.** Every region had carried the same water range, built around one
  United States figure. Each now carries its own, from the World Resources Institute's guidance on
  water embedded in purchased electricity: the national consumption factors in its Appendix 2, the
  two eGRID subregions from Appendix 1, and the generation-weighted global average from its Table 4,
  read from the paper on 2026-09-13 and converted at 3.785 litres per US gallon. The factors are
  water consumed at generation, which is the quantity this project means by off-site water. The
  spread is wide: Ireland 1.48 L/kWh, Brazil 18.58. Each row cites the guidance in `waterSource`,
  beside the grid citation in `source`, and its note says where the number came from and why the
  range is 0.7 to 1.5 times it. Singapore and South Africa are not among the paper's 47 countries
  and take the global average with a half-to-double band; so does the Google fleet row, as the
  assumption it is.
- The United States factor, 3.14 L/kWh, sits beside the 3.1 from Li and colleagues that the
  appendix had transcribed, which is the cross-check the change rests on.

Known gaps, in the order they should be closed:

1. Tokenizer ratios for Anthropic and Google need measuring against the providers' counting endpoints.
2. National water factors for Singapore and South Africa, from a source that covers them.
3. Every proxy row should be replaced by a measurement the moment one is published.

## 0.3.0

Data only, so a minor bump.

- **Regions.** The two eGRID subregions are read from the EPA's eGRID2023 Summary Tables, revision 2:
  California (CAMX) 195.0 gCO2e/kWh, recalled as 210, and Virginia and the Carolinas (SRVC) 270.5,
  recalled as 290. The national row was verified against the same sheet, 770.884 lb/MWh to 349.7
  g/kWh as the appendix had it, and its provenance is now `fetched` too. No region row is recalled
  from memory any more.

Known gaps, in the order they should be closed:

1. Off-site water needs the per-region factors from the World Resources Institute appendix; every
   region still carries the same range built around the United States figure.
2. Tokenizer ratios for Anthropic and Google need measuring against the providers' counting endpoints.
3. Every proxy row should be replaced by a measurement the moment one is published.

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
