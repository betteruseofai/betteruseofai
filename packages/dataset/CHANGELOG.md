# @betteruseofai/dataset

## 3.2.0

Data only, so a minor bump.

- **Claude Code and Codex CLI hide nothing from the input count.** Both report the provider's own
  count, system prompt included, so their hidden context factor is one, not up to 1.05. Their
  highs drop by up to five per cent and they no longer carry the `input-partial` flag, whose
  explanation, a hidden system prompt, wasn't true for them (audit E16).
- The regions note no longer says every region shares one United States water range; each has its
  own WRI factor since 0.4.0.

## 3.1.0

Data only, so a minor bump.

- **Litres of petrol burned, a carbon comparison.** 2,347.7 g of CO2 a litre, from the US EPA's
  8,887 g a gallon, read from its page on 30 October 2026. The largest carbon comparison before
  was a kilometre driven, which runs out at 24 kg, so a month of agent sessions had none and the
  dashboard's "Put another way" left carbon out (audit P8). This one covers up to 235 kg.

## 3.0.0

A schema change, so a major bump: a benchmark row that publishes water or carbon directly must now
say what that figure counts, in `perPrompt.directScope`, using the engine's own three scopes. Found
in the audit of 19 October 2026 (`docs/AUDIT-2026-10.md`, S3).

- **Direct figures follow the water scope setting.** Before, a row's published water was shown
  whatever the setting said. A wider scope than the row's now adds what the row leaves out where
  we can work it out, and a narrower one gives unknown, because nobody can take the on-site part
  back out of a lifecycle total.
- **The Altman statement and the Oviedo et al. row are recorded as on-site.** Neither source says.
  Both figures are far too small to hold the power station's water for the same energy at the world
  average (about a fifth and a fiftieth of it), so we take them as cooling only; the reasoning is in
  each row's notes. At the default scope the off-site water is now added from the row's energy, so
  a GPT-5 prompt of 200 tokens in and 300 out in the United States reads 1.39 mL central where it
  read 0.32.
- **Mistral Large 2 is recorded as lifecycle.** Its water and carbon show only under the lifecycle
  setting and are unknown under the other two, where before they showed under all three.

## 2.0.0

A schema change, so a major bump: a benchmark row may now carry `includesThinking`, true when the
measurement ran the model's reasoning and the rate already holds the thinking. Found in the audit
of 19 October 2026 (`docs/AUDIT-2026-10.md`, E1 and E2).

- **Thinking is no longer added twice.** Six rows now say their measurement included the reasoning:
  `jegham.o3`, whose own note already said so, `jegham.o4-mini`, measured on high effort,
  `jegham.deepseek-r1`, the Altman statement, the Gemini Apps median and the Hugging Face R1
  distill row. Proxy rows inherit it, so GPT-5.6 and Gemini 2.5 Pro do too. o3 on 200 in and 300
  out drops from 5.45 Wh to 1.64 central, which is what the row measured.
- **PUE is no longer applied twice on the Jegham rows.** Their equation 1 ends in a factor of PUE,
  so the published per-query figures already carry it. All nine `jegham.*` rows, and the five
  proxies scaled from them, now set `energyIncludesPue`. Claude 3.7 Sonnet on a short prompt lands
  on the published 0.950 Wh rather than 1.08. Every Claude model, and every OpenAI model except
  GPT-5, reads 12 to 14 per cent lower.
- **On-site water is charged on the servers' energy.** WUE is defined against IT energy, so the
  engine now divides by PUE before applying it, as Jegham et al. and EcoLogits both do. The Google
  row gives 0.25 mL against the published 0.26, where it gave 0.28 before.
- **A row with no on-site water figure gives unknown water, not zero.** The R1 distill row is
  measured at the GPU and publishes none.

## 1.1.0

- **Claude Opus 5.5 and Claude Sonnet 5.5.** Both appeared in the author's own Claude Code
  transcripts from 23 September 2026 and were showing as unknown: 6,412 turns, nearly every turn of
  the fortnight. They now sit on their own ladder, `claude-5.5`, priced through the existing Opus and
  Sonnet proxy rows, so every estimate for them carries the proxy-row flag and reads as scaled from
  the one measured Sonnet rather than measured. The names are read from the identifiers. A model
  that goes unrecognised for ten days is the gap the plugin's every-ten-turns message now names.


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
