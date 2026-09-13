# Design audit, phase 1: constraints and conflicts

> Working document. Written 2026-09-12 against commit `965a69f` and the brief in
> `docs/design/BRIEF.md`. Nothing below has been acted on. The audit stops here, by design, until
> each conflict has a decision against it.

## What happened next

Decisions were taken on every item on 2026-09-13 and the work is recorded in `docs/DECISIONS.md`,
entries 26 to 38. Two things stayed open: the mark, which is at the three-directions gate, and the
code of conduct. The rest of this document is the audit as it was written, and the line numbers in
it refer to commit `965a69f`.

## How to read this

Part 1 is the Constraint Inventory: every rule the repo states or implies, with where it is
written and whether the built work holds to it today. Part 2 is the Conflict Report: the places
where two constraints, or a constraint and the brief, cannot both be true, each with options and a
recommendation.

Quotes are short and the line numbers are from the commit above. `PLAN.md` is quoted as the
approved plan even where later work has knowingly departed from it, because those departures are
themselves findings.

Every figure in this document was measured on this machine during the audit, from the built
output in `apps/site/dist` and `apps/extension/.output/chrome-mv3`, unless it says otherwise.

### What was measured

| What | Measured | Budget in `PLAN.md` | Budget in the brief |
|---|---|---|---|
| Landing page script, gzipped | 7.3 kB (16.3 kB raw), in five files | 25 kB (`PLAN.md:248`, enforced by `apps/site/tests/site.test.ts:313`) | 60 kB |
| Of which the backdrop | 5.6 kB gzipped (13.2 kB raw) | | |
| Landing page CSS, gzipped | 4.4 kB | | |
| Landing page HTML, gzipped | 6.1 kB | | |
| Fonts, six faces | 116.4 kB | 130 kB (`PLAN.md:248`, enforced by `packages/tokens/scripts/copy-fonts.mjs:32`) | "self-hosted subset" |
| Landing page total over the wire | 134.3 kB | 250 kB (`PLAN.md:248`, enforced by `site.test.ts:335`) | 400 kB |
| Extension background worker | 169,410 bytes | | |
| Extension tokenizer table, packaged | 2,325,547 bytes | | |
| Largest Contentful Paint | not measured | 1.5 s (`PLAN.md:248`) | 2.0 s on 4G |
| Frame rate on integrated graphics | not measured | | 60 fps |
| Session report from the CLI | 35 lines | | 6 lines or fewer |
| Contrast pairs failing 4.5:1 for text | 1 of 90 checked (see X-04) | 0 | 0 |

The engine, run for one typical exchange of 400 tokens in and 300 out on the world average grid:

| Model | Energy, central Wh | Flags |
|---|---|---|
| `claude-opus-5` | 5.06 (0.57 to 60.5) | proxy-row, thinking-unknown |
| `claude-sonnet-5` | 2.78 | proxy-row, thinking-unknown |
| `claude-haiku-4.5` | 0.62 | proxy-row, thinking-unknown |
| `llama-3.1-8b`, local | 0.017 | parametric-rate |

So the frontier model costs about eight times the small hosted model and about three hundred
times the small local one. Both ratios are quoted on the site, and they are not labelled as
different comparisons (X-12).

---

## Part 1: Constraint Inventory

Status column: **held** means the built work follows it today, **partly** means some surfaces
do, **not held** means it is written down and not done, **stale** means the text no longer
describes the repo.

### Stack and dependencies

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-01 | pnpm 10 and Turborepo monorepo, TypeScript throughout, Vitest | `PLAN.md:27`, `package.json:6` | held |
| C-02 | Node 22 for CI and Cloudflare, 24 locally; `engines.node >=22` | `docs/toolchain.md:9`, `package.json:8`, `.node-version` | held |
| C-03 | Site is Astro, static output, no adapter, no server | `apps/site/astro.config.mjs:8-15`, `apps/site/README.md:3` | held. `PLAN.md:79,206` still says Astro 5; the repo runs 7.3.2 (`apps/site/package.json:25`) |
| C-04 | Vanilla CSS with tokens, no Tailwind | `PLAN.md:206` | held |
| C-05 | Preact islands only where a page needs state; the calculator is the only island | `apps/site/README.md:32`, `PLAN.md:206` | held. The backdrop is a plain page script, not an island |
| C-06 | The landing page imports no package; the engine runs at build time | `apps/site/src/lib/landing.ts:4-7`, `apps/site/src/pages/index.astro:263-264` | held |
| C-07 | No animation library; the backdrop is a hand-written WebGL2 shader with a canvas 2D fallback | `CLAUDE.md` deviation 19, `apps/site/src/islands/dither/render.ts:14-16` | held |
| C-08 | Extension built with WXT, Manifest v3 on Chrome and Firefox, Preact for its pages | `apps/extension/wxt.config.ts:29`, `apps/extension/package.json:19-33` | held |
| C-09 | Extension pages are not minified, so a reviewer can read the interceptor | `wxt.config.ts:105-107` | held |
| C-10 | No chart library in the extension; bars are divs | `apps/extension/src/entrypoints/dashboard/App.tsx:12-15` | held. `PLAN.md:75` said "uPlot charts" |
| C-11 | Python CLI has zero runtime dependencies | `apps/cli-py/pyproject.toml:20` | held |
| C-12 | CLI arguments parsed by hand, not Commander, so help text follows the copy rules | `CLAUDE.md` deviation 6, `apps/cli-ts/src/help.ts:1-4` | held. `PLAN.md:76` still says Commander |
| C-13 | Runtime dependencies in shipped surfaces: preact, @preact/signals, idb, zod, js-tiktoken, astro, @astrojs/* | `apps/extension/package.json`, `apps/site/package.json`, `packages/tokenizers/package.json` | All MIT or ISC. Checked against each package's licence field |

### Browser support

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-14 | Chrome and Firefox; Firefox needs `strict_min_version: "128.0"` for page-world scripts | `wxt.config.ts:73`, `CLAUDE.md` technical facts | held |
| C-15 | Firefox on Manifest v3, not v2 | `wxt.config.ts:23-29` | held. `apps/extension/README.md:38-39` still says the interceptor fetch is "the build tool's way of injecting it on Manifest V2" (stale) |
| C-16 | WebGL2 with a canvas 2D fallback, so no browser sees a blank rectangle | `render.ts:10-12`, `render.ts:302` | held |
| C-17 | The site works without JavaScript except the calculator | `PLAN.md:248`, `site.test.ts:159-179` | held. The landing readouts are server-rendered; the dialer and theme toggle need script |
| C-18 | `mask-image` and `color-mix()` used in the backdrop CSS without fallbacks | `apps/site/src/styles/global.css:519-520, 536, 566` | partly. Both are supported in current Chrome, Firefox and Safari; a browser without them shows an unmasked field behind the headline. Not tested |

### Privacy and telemetry

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-19 | Strictly local. No backend, no accounts, no telemetry, no remote flags, no benchmark fetches | `CLAUDE.md` rule 2, `PLAN.md:21`, `README.md:27-29`, `CONTRIBUTING.md:50-51` | held. No network code found in `apps/cli-ts/src`, `packages/readers/src`, `packages/core/src` or `apps/cli-py/src` |
| C-20 | The extension makes no network request; a test reads the built files and fails on any network call not on an allow list of two | `apps/extension/test/no-network.test.ts`, `apps/extension/README.md:31-39`, `apps/site/src/pages/privacy.astro:33-41` | held |
| C-21 | The one permitted third-party script is the Cloudflare Web Analytics beacon, loaded as a manual snippet only when `PUBLIC_CF_BEACON_TOKEN` is set, and named on the privacy page | `CLAUDE.md` rule 2, `apps/site/src/layouts/Base.astro:72-81`, `privacy.astro:55-65` | held |
| C-22 | Every request the site makes: its own HTML, one CSS file, five script files, six woff2 files, `theme.js`, plus the beacon and its post to `/cdn-cgi/rum` when enabled. Build-time reads of `api.github.com` never reach a browser | `Base.astro`, `apps/site/src/loaders/github.ts:1-8`, `_headers:2` | held. The content security policy starts at `default-src 'none'` |
| C-23 | Fonts self-hosted, no font CDN | `packages/tokens/fonts.css:1-4`, `privacy.astro:70-71` | held |
| C-24 | Calculator state in the URL hash, never the query string | `CLAUDE.md` conventions, `apps/site/src/islands/Calculator.tsx:9-12`, `site.test.ts:247-267` | held |
| C-25 | One `localStorage` key, `buoa-theme`, disclosed | `privacy.astro:79-80`, `apps/site/src/components/ThemeToggle.astro:5` | held |
| C-26 | Extension permissions: `storage`, `unlimitedStorage`, `alarms`, four hosts; localhost optional | `wxt.config.ts:38-49`, `apps/site/src/pages/install.astro:100-128` | held. Confirmed in the built manifest |
| C-27 | Prompt text is never stored; a hash where two exchanges must be told apart | `PLAN.md:98`, `privacy.astro:44-46` | held per the extension README; not re-verified in this audit |
| C-28 | CI never touches live provider sites or APIs | `.github/workflows/ci.yml:13-14`, `PLAN.md:262` | held |

### Licensing

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-29 | MIT for the repo and the dataset structure | `LICENSE`, `README.md:47`, `about.astro:95-97` | held |
| C-30 | No code copied from GPL prior art; credit it in the README | `CLAUDE.md` rule 7, `README.md:64-65`, `CONTRIBUTING.md:48-49` | held |
| C-31 | Vendored data must be CC BY 4.0 or public domain; Electricity Maps (ODbL) and IEA (paid) are out | `docs/dataset-contributing.md:72-74`, `PLAN.md:291-292` | held |
| C-32 | Fonts are SIL OFL 1.1 (Big Shoulders, Schibsted Grotesk, IBM Plex Mono) | `PLAN.md:191`, each `@fontsource/*` package declares `OFL-1.1` | partly. The licence text is not shipped with the fonts anywhere in the repo or the published package (X-07) |
| C-33 | No AI attribution in commits, PRs, site, README, metadata or comments; a hook enforces it | `CLAUDE.md` rule 1, `CONTRIBUTING.md:8-24`, `scripts/check-commit-msg.mjs`, `ci.yml:49-77` | held |

### Performance

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-34 | Landing script at most 25 kB gzipped | `PLAN.md:248`, `site.test.ts:313-322` | held at 7.3 kB. `CLAUDE.md` deviation 18 says the budget was raised to 150 kB on 2026-09-12; the test was not changed and did not need to be |
| C-35 | Landing total at most 250 kB over the wire | `PLAN.md:248`, `site.test.ts:335-351` | held at 134.3 kB |
| C-36 | Fonts at most 130 kB | `PLAN.md:248`, `copy-fonts.mjs:32`, `site.test.ts:324-333` | held at 116.4 kB |
| C-37 | Calculator script at most 70 kB gzipped including core | `PLAN.md:248` | not enforced by any test. Not measured in this audit |
| C-38 | LCP at most 1.5 s, CLS 0, Lighthouse mobile performance at least 98 | `PLAN.md:248` | not held. No Lighthouse run exists in the repo or CI, though `PLAN.md:260-262` lists "Lighthouse CI budgets" |
| C-39 | Status line answers in tens of milliseconds; the shim reads a cached line in about 48 ms on this machine | `PLAN.md:48,171`, `apps/claude-code-plugin/README.md:40-48`, `apps/cli-ts/src/commands/statusline.ts:58-63` | held, with the measured caveat written down |
| C-40 | The backdrop does no work off screen, and does none under reduced motion | `dither/index.ts:193-206, 10-11` | held. There is no explicit pause on `document.hidden`; browsers stop `requestAnimationFrame` in hidden tabs, so the effect is the same, but the brief asks for it explicitly (X-14) |
| C-41 | Motion is 120, 200 or 320 ms, opacity and transforms of at most 8 px, no parallax, no scroll-jacking | `PLAN.md:202`, `packages/tokens/tokens.css:73-77` | not held by the backdrop, which runs a 27 s loop and a scroll-driven swell (X-01). Held by every component |

### Accessibility

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-42 | WCAG 2.2 AA: 4.5:1 for text, 3:1 for interface borders; every pair asserted by test | `PLAN.md:248`, `packages/tokens/test/contrast.test.ts:69-155` | partly. One pair the test does not cover fails (X-04) |
| C-43 | No band or state encoded by colour alone; the high band is hatched | `packages/tokens/components.css:208-225`, `PLAN.md:189` | held |
| C-44 | 2 px accent focus ring, skip link, one h1, `lang="en-GB"`, a main landmark, every control named | `components.css:69-72`, `site.test.ts:98-157` | held |
| C-45 | 24 px minimum target size | `PLAN.md:248` | plausible fail on the theme toggle: 4 px vertical padding round 11 to 12 px mono text (`components.css:628-639`). Not measured in a browser |
| C-46 | Native `<details>` for FAQ and source panels, no focus traps | `apps/site/src/components/SourceChip.astro:5-7`, `Faq.astro:5` | held |
| C-47 | Decorative canvas and tape are `aria-hidden`; a visually hidden line carries the tape's words | `DitherField.astro:16`, `Tape.astro:10-11` | held |
| C-48 | `prefers-reduced-motion` respected everywhere; the backdrop holds one frame | `tokens.css:127-133`, `components.css:840-848`, `dither/index.ts:222-226` | held mechanically. The held frame is the mid-dissolve, the noisiest one (X-14) |
| C-49 | A reader is never told less than a sighted reader gets (`Redacted` keeps its text in the DOM) | `apps/site/src/components/Redacted.astro:5-7` | held |

### Brand and design

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-50 | Light first; warm off-white ground `#eeece9`; dark theme secondary | `CLAUDE.md` rule 5, `PLAN.md:25`, `tokens.css:14-18, 80-101` | held |
| C-51 | Exactly one accent hue, green, asserted by test | `CLAUDE.md` rule 5, `contrast.test.ts:173-192` | held |
| C-52 | One warm state colour (`--hazard`) and one danger colour | `tokens.css:32-34` | held. This is the brief's "one warm tone reserved for high-impact states" |
| C-53 | Hard corners, `--radius: 0`, asserted by test | `tokens.css:40-41`, `contrast.test.ts:158-164` | held |
| C-54 | No gradients apart from the hazard hatching | `tokens.css:7-8`, `components.css:8-9`, `contrast.test.ts:166-171` | partly. The test reads only `components.css`. `global.css:529-539` adds a gradient scrim behind the headline and calls itself "the one exception the rule already carves out", which the rule does not (X-01) |
| C-55 | IBM Plex Mono for every number, tabular figures, slashed zero | `CLAUDE.md` rule 5, `contrast.test.ts:194-202` | held |
| C-56 | Big Shoulders display, Schibsted Grotesk body; no font stack falls back to Inter | `tokens.css:44-46`, `contrast.test.ts:204-212` | held |
| C-57 | Visible hairline grid on landing, methodology and calculator | `PLAN.md:202`, `components.css:91-110`, `Base.astro:24` | held |
| C-58 | No hero image, no centred hero, no three cards, no stock icon grid, no emoji | `CLAUDE.md` rule 5, `PLAN.md:224`, `global.css:83-86` | held for the components. The backdrop is not an image, and the plan did not foresee it |
| C-59 | Buttons are mono uppercase verbs with an object | `docs/STYLE.md:34-35`, `components.css:493-495` | held ("Run the numbers", "Read the method", "Delete everything stored") |
| C-60 | Big Shoulders is not loaded in the extension, for weight | `PLAN.md:146` | not held. `popup/main.tsx:6` imports `fonts.css`, and `popup.css:29` uses `--font-display`. Inside a packaged extension the weight argument is moot, so this is a plan-text problem rather than a design one |
| C-61 | The popup re-implements `Readout`, `RangeBar`, `Tape`, `MetaStrip` against the same class names | `PLAN.md:146`, `components.css:4-6` | held |
| C-62 | `tokens.json` and `tokens.css` say the same thing, asserted by test | `tokens.json:2`, `contrast.test.ts:48-62` | held. Neither is generated from the other (X-08) |
| C-63 | The composer hint has its own styles in a shadow root | `packages/ui-hint/src/index.ts:5-7, 34-120` | held, with the palette copied by hand as hex (X-08) |
| C-64 | The mark is an eight-cell grid; every cell lands on a whole pixel at 16, 48 and 128 | `packages/tokens/logo/build.mjs:5-9` | held for the three routes. No lockups, icons, or usage doc yet (X-06) |
| C-65 | Extension icons at 16, 32, 48 and 128 | brief Phase 3; Chrome Web Store and AMO both require a 128 px icon | not held. The built manifest has no `icons` key and the site has no favicon (X-05) |
| C-66 | Reference register: brikken.co, daoism.systems, "slightly dystopian", an instrument panel not a launch page | `docs/STYLE.md:13-14`, `tokens.css:8` | held |

### Motion

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-67 | The backdrop follows native scroll in a passive listener; scroll position is read, never written | `CLAUDE.md` deviation 21, `dither/index.ts:7-8` | held |
| C-68 | Four paired dissolves, sharing a composition so each has something to land on; a caption names the pair | `CLAUDE.md` deviation 20, `dither/scenes.ts:4-19` | held |
| C-69 | The canvas 2D fallback runs at a coarser grid and without the fields' own motion | `render.ts:10-12`, `dither/index.ts:145-151` | held. It still walks every cell in JavaScript on every frame (X-15) |
| C-70 | Reduced motion gets a fully composed still, designed first | brief Phase 4 | not held (X-14) |
| C-71 | A visible still-mode toggle whose choice is remembered | brief Phase 4 | not held. Only the OS setting is honoured |
| C-72 | The page's own transfer weight in the footer | brief Phase 4, and `PLAN.md:224` "a self-aware page-weight ticker" | not held. `MetaStrip.astro:17-23` shows dataset, hash, build time, telemetry and licence |

### Tone and copy

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-73 | British English, "we", present tense, contractions, sentences averaging under twenty words | `docs/STYLE.md:9-11`, `docs/VOICE.md:57-61`, `apps/site/scripts/copy-lint.mjs:120-167` | held on the built pages, measured by the copy lint |
| C-74 | Banned words and constructions, enforced by eleven Vale rules | `docs/STYLE.md:20-36`, `styles/BUAI/*.yml`, `.vale.ini` | held |
| C-75 | Every number in published copy sits next to a source chip or a link | `docs/STYLE.md:40-41`, `copy-lint.mjs:108-115` | partly. The lint checks pages that print readouts. Numbers spelled out in prose escape it (X-12) |
| C-76 | Absence never renders as zero | `CLAUDE.md` rule 3, `CONTRIBUTING.md:58-61`, `Readout.astro:5-8`, `site.test.ts:280-291` | held |
| C-77 | Every page is `status: draft` until Anirudh has read it | `docs/STYLE.md:3-5`, `apps/site/src/lib/status.ts`, `ReviewGate.astro` | held. All sixteen pages are draft |
| C-78 | One `Hazard` block per page; the copy lint enforces it | `Hazard.astro:3-4` | stale. `copy-lint.mjs` has no such check. The calculator page renders two hazard blocks when the local comparison is on (`Calculator.tsx:484`, plus the one in `local-llms` is on another page). Not a conflict, a missing check |
| C-79 | The brief's tone for the extension: an ambient meter, never a scold | brief Phase 5, `ui-hint/src/index.ts:9-15`, `popup/App.tsx:68` | held |

### Naming

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-80 | The tool is "Better Use of AI"; the package, command and plugin are `betteruseofai` | every manifest | held |
| C-81 | Repository slug | `apps/site/src/components/Footer.astro:36` and `_redirects:1` say `betteruseofai/betteruseofai`; `apps/claude-code-plugin/README.md:11` says `gordianknot-legacy/better`; `PLAN.md:66` says `betteruseofai/better` | not held: three slugs (X-10) |
| C-82 | Abbreviation | CSS prefix `buoa-`, env vars `BUOA_*`, element `<buoa-hint>`; the Vale style is `BUAI` (`styles/BUAI`, `.vale.ini:10`) | two abbreviations (X-10) |
| C-83 | File references in docs | `docs/toolchain.md:15` names `.github/workflows/site.yml` (the file is `copy.yml`); `docs/STYLE.md:50` names `scripts/copy-lint.ts` (it is `apps/site/scripts/copy-lint.mjs`); `STYLE.md:53` says the Vale rules have not landed (they have) | stale (X-11) |

### Quantified claims

Every number a reader meets in copy, with what backs it.

| ID | Claim | Where | Backing | Verdict |
|---|---|---|---|---|
| Q-01 | Google median text prompt 0.24 Wh, 0.26 mL on site | `index.astro:101-107`, `README.md:37`, SKILL.md:14 | dataset row `google.gemini-apps.2025-median`, source arXiv:2508.15734 | backed. The landing chip links `https://cloud.google.com/blog`, the blog root, while the dataset row carries the arXiv URL (X-12) |
| Q-02 | Mistral Large 2 life cycle, 45 mL for a page of text | `index.astro:108-114`, `README.md:37-39` | dataset row `mistral.large-2.lca.2025` | backed |
| Q-03 | "about 170 times higher on water" | `README.md:38-39`, blog `estimating-water-per-prompt.md:10` | 45 / 0.26 = 173 | backed, no link to the method page from the README |
| Q-04 | "A frontier model asked to do arithmetic costs a few hundred times what a small one costs" | `about.astro:37-38` | engine: 295 times against the local 8B model, 8 times against the small hosted model | ambiguous, unsourced (X-12) |
| Q-05 | frontier "near 5 Wh, with a range from about 0.6 to 60"; small "near 0.6 Wh"; "roughly eight times" | blog `frontier-by-default.md:9-11` | engine: 5.06 (0.57 to 60.5) and 0.62 | backed |
| Q-06 | "grids differ by a factor of thirty" | `options/App.tsx:60-61` | dataset: Sweden 24 to India 710 gCO2e/kWh, ratio 29.6 | backed by rows of which 18 of 21 are `recalled-pending-refetch` (X-12) |
| Q-07 | "Google's own two figures differ by three and a half times" | `options/App.tsx:121-122`, SKILL.md:59 | 345 / 94 = 3.67 | backed, rounded down |
| Q-08 | "about 48 milliseconds" for the status line | `install.astro:171`, plugin README:42 | measured on this machine, and says so | backed |
| Q-09 | "The background worker is under 170 kB" | `install.astro:156-157` | 169,410 bytes | backed, narrowly |
| Q-10 | "That keeps the landing page at about 2.4 kB of script" | `apps/site/README.md:39` | 7.3 kB gzipped today | stale (X-11) |
| Q-11 | "from a figure now seventeen years old" (the 2009 Google search figure) | `popup/App.tsx:108`, `dashboard/App.tsx:143` | 2026 minus 2009 | backed until 1 January 2027, then wrong; the year is in the dataset and the string is typed by hand (X-12) |
| Q-12 | "about 2.4 full smartphone charges" beside "about 1.6 smartphones charged from empty" in one list | CLI `summary` output | two equivalence rows, one energy at 19 Wh a charge, one carbon at 12.4 g a charge | both backed; read together they contradict (X-12) |
| Q-13 | "a formula came out about a third low" against one measured card | `methodology.astro:294-296`, `local-llms.astro:178-179`, `Calculator.tsx:488-489` | `PLAN.md:301` local inference appendix | backed by the appendix, no source chip on the page |
| Q-14 | "Nobody pays for this. There is no company behind it" | `about.astro:61-62` | a statement of fact by the author | fine; the affiliation line beside it is still `Redacted` |

---

## Part 2: Conflict Report

Twenty-one conflicts, ordered by how much they change the work ahead. Each carries the fields the
brief asked for. Severity: **blocks** a phase, **changes** copy or design, **tidies** text or
tests.

| ID | Title | Severity |
|---|---|---|
| X-01 | The animated backdrop against the frugality thesis | changes |
| X-02 | The brief's three motion moments against the landing that exists | blocks phase 4 |
| X-03 | The brief's palette against the one-hue rule | blocks phase 2 |
| X-04 | One contrast pair fails, and two live near the field | changes |
| X-05 | No icons anywhere: extension manifest, site, store listings | blocks release |
| X-06 | Three marks, no lockups, no icon exports, no usage doc, and a circle crop that clips | blocks phase 3 |
| X-07 | Fonts are OFL and the licence text is not shipped | changes |
| X-08 | One token file in name; three palettes in practice | changes |
| X-09 | Terminal rules: `NO_COLOR` ignored, session report 35 lines | changes |
| X-10 | Three repository slugs and two abbreviations | tidies |
| X-11 | Documents describing a repo that has moved on | tidies |
| X-12 | Quantified claims that need a source, a qualifier or a computed value | changes |
| X-13 | The one third-party request against "no third-party requests" | none, recorded |
| X-14 | Reduced motion and the still frame; the missing toggle; `document.hidden`; layout per frame | changes |
| X-15 | Performance targets that nothing measures | changes |
| X-16 | Extension policy against the site's motion: they cannot share a runtime | none, recorded |
| X-17 | Files the brief expects that the repo lacks | tidies |
| X-18 | The mark in a dark toolbar | blocks phase 3 |
| X-19 | Onboarding, and the one number a user sees most | changes |
| X-20 | The gradient rule and its self-declared exception | tidies |
| X-21 | "We send about" on the landing sentence | changes |

### X-01. The animated backdrop against the frugality thesis

| | |
|---|---|
| Constraint A | `PLAN.md:202` "Motion: 120/200/320 ms, opacity and ≤ 8 px transforms, digit count-up, no parallax or scroll-jacking". `PLAN.md:224` "Landing: no hero image." `tokens.css:7-8` "Nothing is rounded and nothing is a gradient, apart from the one hazard stripe." The brief, Phase 1: an animated hero "has a real per-visitor energy cost on a page arguing for compute frugality. I want an explicit stance." |
| Constraint B | `dither/index.ts:23-28`: a 27.2 s loop of four dissolves, running on `requestAnimationFrame` whenever the band is within 120 px of the viewport. `dither/index.ts:86-91`: a scroll-driven swell. `global.css:529-539`: a gradient scrim. `CLAUDE.md` deviations 18 to 21 record that the user agreed to this on 2026-09-12. |
| Why they collide | The plan's motion rule was written for components and forbids anything continuous. The backdrop is continuous by design. Both are approved documents and only one has been updated. |
| What breaks if ignored | A reader who knows the subject notices a page about the cost of computation running a GPU shader for as long as the tab is open, and the site's own metastrip says nothing about it. The plan and the site disagree, so the next person to touch motion has no rule to follow. |
| Measured cost | Script: 5.6 kB gzipped, 13.2 kB raw. Fields: eight canvas renders at load, a few ms. Per frame: one full-screen WebGL2 draw at about one fragment per 5 css px, roughly 40,000 to 60,000 fragments at 1440 by 300, on `powerPreference: 'low-power'`. Energy per visitor: not measured; a shader this size on an integrated GPU is in the order of tens of milliwatts while running, which over a two-minute visit is well under one joule, against about 130 kB of transfer. The canvas 2D fallback is the expensive path (X-15). |
| Options | (a) Keep it, and make it honest: play one full loop then hold on the last built frame; pause on `document.hidden`; add the still-mode toggle (X-14); print the page's transfer weight and the backdrop's script size in the metastrip; write the rule into `PLAN.md` so the two documents agree. (b) Keep the sequence but drive it entirely by scroll, so it costs nothing while the reader is still. Loses the water drift and grain settle, which are time-based. (c) Remove the motion and ship the held frame as a static composition. Cheapest, and it gives up the one thing on the page that makes the "one geometry" argument visibly. |
| Recommendation | (a). The stance, in one sentence for `docs/design/MOTION.md`: the backdrop is the argument, not decoration, so it earns its cost only while it is making the argument, once, and then it stops. A loop that runs forever is decoration. Bounding it to one pass makes the per-visitor cost fixed and small enough to print. |

### X-02. The brief's three motion moments against the landing that exists

| | |
|---|---|
| Constraint A | Brief Phase 4: hero morph "quartz lattice → water ripple → wafer → die shot → server rack → a cursor blinking in a prompt box"; a cost moment where "the ripple travels back up the chain"; a recovery moment where "the user's own saving" is rendered as regrowth. Structure: hero, cost, how it works, install surfaces, methodology and proof, community, footer. |
| Constraint B | `dither/scenes.ts:4-9`: canopy to rack, river to coolant, soil to wafer, roots to traces. `index.astro`: hero, "What the range is doing there", "Three ways in", "Running it yourself", FAQ. No cost moment, no recovery moment, no community section, no proof-point numbers or recommender screenshot (`PLAN.md:224` promised both). `CLAUDE.md` rule 3 and `README.md:41-43`: every figure is a range with a source. The site has no way to know a reader's own saving. |
| Why they collide | The brief was written before the backdrop existed and describes a different sequence. The recovery moment needs a personal saving the website cannot compute; only the extension and the CLIs see a person's usage, and the recommender's `estimatedSavings` (`PLAN.md:133`) is per prompt, not a total. Rendering "your saving" on a landing page would be a number without a source, which rule 3 forbids. |
| What breaks if ignored | Rebuilding the hero to the brief throws away agreed work that already passes the brief's own "one geometry" test. Building the recovery moment on the landing puts an unbacked number in the most visible place on the site, which the brief itself names as the fastest way to lose this audience. |
| Options | (a) Keep the four-pair hero. Add the cost moment as a still composition: the three readouts joined by a ripple diagram back to water, land and watts, each end labelled and chipped to its dataset row. Put the recovery moment where a real saving exists: the extension dashboard, as rings that accrete per day of recorded use. Add the missing sections (how it works, proof with range bars, community). (b) Rebuild the hero to the brief's six-stage chain, keep the same shader, and drop the recovery moment. (c) Build all three moments as the brief describes and label the recovery moment as illustrative. |
| Recommendation | (a). It respects both rule 3 and the decision of 2026-09-12. The cursor-in-a-prompt-box ending from the brief can still land as the final held frame of the fourth pair if the dissolve ends on a composer rather than on traces; that is a scene change, not a rebuild. Decision needed: does the hero end on traces or on a prompt box? |

### X-03. The brief's palette against the one-hue rule

| | |
|---|---|
| Constraint A | Brief Phase 2: "Palette anchored in quartz and sand, wafer iridescence, pine and moss, deep water, with one warm tone reserved for high-impact states." |
| Constraint B | `CLAUDE.md` rule 5: "one green accent (`#0f6b3a`)". `contrast.test.ts:173-192`: "there is exactly one accent hue", asserted in the 120 to 175 degree band. `contrast.test.ts:166-171`: the only gradients are the hazard hatching. `tokens.css:7`. |
| Why they collide | Deep water is a second hue. Iridescence is a gradient by definition. Both are ruled out by tests that fail the build. |
| What breaks if ignored | Adding a blue turns the readouts into a two-colour system where the eye has to learn which colour means what; the existing system encodes state by hatching and position precisely so that colour never carries meaning alone (C-43). A gradient anywhere reopens every generated-looking pattern the rule exists to keep out. |
| Options | (a) Keep one hue and map the brief's nouns onto the tokens that exist: quartz and sand are `--bg`, `--bg-raised`, `--bg-sunken` (`#eeece9`, `#f6f5f2`, `#e4e1dc`); pine and moss are `--accent` and `--accent-tint`; the warm tone is `--hazard`. Deep water is not added. Iridescence is expressed as ordered dither in the ink colour, which the backdrop and the mark already do, never as a colour gradient. (b) Add a deep-water token for water readouts only, change the test to allow two hues, and write the rule for when each may appear. (c) The brief's palette in full, tests rewritten. |
| Recommendation | (a). Write the mapping into `docs/design/BRAND.md` so the brief's language and the token names refer to the same things. Every ratio for the pairs that would carry text is in the table at the top of Part 1 and in X-04. |

### X-04. One contrast pair fails, and two live near the field

| | |
|---|---|
| Constraint A | Brief: "Any brand colours already documented vs. WCAG 2.2 AA (4.5:1 text, 3:1 non-text and UI)." `PLAN.md:248`. |
| Constraint B | Measured from `tokens.json`. Light theme: `--muted` on `--accent-tint` is **4.49:1**. The design sheet (`design.astro:31`) documents the tint as "selected rows", and muted is the label colour, so the two meet in any selected table row. Documented and asserted below 4.5: `--muted` over a filled dither cell 3.70, `--accent` over a filled cell 4.08 (`contrast.test.ts:113-122`). `--hairline` on `--bg` is 1.37 in both themes. |
| Why they collide | The tint was chosen as a fill and the test only checks `--ink` on it (`contrast.test.ts:151-154`). Nothing checks `--muted` on it. The dither field is masked away below about 58 per cent of the band (`global.css:500`), but the caveat under the readouts is `.note`, which is muted, and on narrow screens the scrim drops to 52 per cent opacity (`global.css:566`), so muted text can sit over live cells. The hairline is decorative by design (`dither/index.ts:134-135`, `PLAN.md:187`), and WCAG 1.4.11 exempts decoration, but the range bar's trough border is a hairline too. |
| What breaks if ignored | An automated accessibility check fails on any page with a selected row and a label in it. Small mono captions over the field are hard to read for anyone with low contrast sensitivity, on the one page most visitors see. |
| Every pair, both themes | Light, on `--bg`: ink 14.23, ink-2 12.72, muted 5.07, accent 5.59, accent-strong 6.88, hazard 5.27, danger 6.27, border-ui 4.05. On `--bg-sunken`: muted 4.59, accent 5.06, border-ui 3.66. On `--accent-tint`: ink 12.59, muted **4.49**, accent 4.95, hazard 4.66. Button, bg on accent: 5.59. Dark, on `--bg`: ink 14.44, muted 7.14, accent 10.37, hazard 9.07, danger 6.64, border-ui 6.24. On `--accent-tint` (dark): muted 4.97, danger 4.62. Nothing else is under 4.5 for text or under 3 for borders in either theme. |
| Options | (a) Nudge `--muted` one step to `#5a655e`: 4.55 on the tint, 5.15 on the ground (inside the test's 5.07 ± 0.15 tolerance), 4.66 on sunken, 3.76 over a filled cell. (b) Forbid muted on the tint in `components.css` and set selected-row labels to `--ink-2`. (c) Leave it and record it. For the field: keep `.note` off the band, or make the caveat `--ink-2`, and give the range bar trough a `--border-ui` edge. |
| Recommendation | (a) for the token, since it is one byte in two files and the test already covers the drift. Move the landing caveat to `--ink-2` and add a `muted on accent-tint` case to the test so it cannot recur. |

### X-05. No icons anywhere

| | |
|---|---|
| Constraint A | Brief Phase 3: "Icon set at 16 / 32 / 48 / 128 for MV3." The Chrome Web Store requires a 128 px icon in the manifest and the listing; AMO expects icons in the manifest. `PLAN.md:266` plans a store submission. |
| Constraint B | The built manifest at `apps/extension/.output/chrome-mv3/manifest.json` has no `icons` key; `wxt.config.ts:31-85` declares none; there is no `public/icon` folder. `Base.astro` has no `<link rel="icon">` and `apps/site/public` has no favicon. `PLAN.md` never mentions icons. |
| Why they collide | A store submission with no icon is rejected before review. Chrome shows a grey puzzle piece in the toolbar, which is the one place the brief says the mark has to survive. |
| What breaks if ignored | Release blocked; the browser tab shows the host's default; the GitHub README header has nothing to show. |
| Options | (a) Extend `packages/tokens/logo/build.mjs` to write PNGs at 16, 32, 48 and 128 for the chosen route with a small hand-written PNG encoder (the images are a few dozen filled squares, so `zlib.deflateSync` plus a CRC is all it takes; no dependency). Point `wxt.config.ts` `manifest.icons` at them, and `Base.astro` at an SVG favicon with a PNG fallback. (b) Add `sharp` as a dev dependency to rasterise the SVG. Apache-2.0, about 30 MB of native binary, for four tiny files. (c) Hand-export from a design tool and commit the PNGs. |
| Recommendation | (a). Zero dependencies, reproducible, and the cell grid was designed so that every size is an integer scale of the same rects. Blocked only on choosing a route (X-06). |

### X-06. Three marks, no lockups, no exports, no usage doc, and a circle crop that clips

| | |
|---|---|
| Constraint A | Brief Phase 3: primary mark, horizontal and stacked lockups, monochrome and reversed; survives a circular GitHub avatar crop, a terminal reduction, a README header; grid, optical corrections, clear space and minimum sizes documented with a usage `README.md`. |
| Constraint B | `packages/tokens/logo/svg/` holds three marks only, each a 10 by 10 box with an 8 by 8 grid and a one-cell margin (`build.mjs:107-124`). No wordmark, no lockup, no README. Terminal glyphs exist (`build.mjs:85-89`). The marks use `currentColor`, so monochrome and reversed are one file each way. |
| Why they collide | The brief asked for three directions and then a stop, and the repo has done exactly that; the rest of Phase 3 has not started. One geometric fact matters before choosing: in a 10-unit box, the corner cells at (1,1) sit 5.66 units from the centre, and a circular crop has radius 5. Every route loses its corners in an avatar. Route A is a diagonal that reads from its solid corner, so it loses the most. |
| What breaks if ignored | Choosing a route on the sheet and finding it fails as an avatar afterwards. |
| Options | (a) Export the avatar with a two-cell margin (a 12-unit box, radius 6 against a corner distance of 5.66), and keep the one-cell margin for the favicon. (b) Design the mark on a 6 by 6 grid so it sits inside the circle at every export. Loses the Bayer-tile logic the mark is built on. (c) Accept the clip. |
| Recommendation | (a), written into the usage doc as two export contexts. Then the gate: pick one of A, B, C. The audit's reading, for what it is worth: B (the seam) is the most literal statement of the brief's "nature and silicon share a single geometry", and the only one with no up or down, which the toolbar, the avatar and the README header all need. A reads as noise at 16 in the dark sheet. C is the strongest at 128 and the weakest at 16. |

### X-07. Fonts are OFL and the licence text is not shipped

| | |
|---|---|
| Constraint A | Brief: "Licence compatibility: the repo's licence vs. every font... Font licences are frequently not the same as code licences." SIL OFL 1.1, condition 1: the copyright and licence notice must accompany any redistribution of the font software. |
| Constraint B | `packages/tokens/package.json:10-15` publishes `fonts/`. `copy-fonts.mjs:39-53` copies the woff2 files and nothing else. The site serves the same files from `/_astro/`. No file in the repo contains the OFL text (searched for "SIL OPEN FONT LICENSE" and "OFL-1.1" outside `node_modules`). `about.astro:93-97` names MIT and the data licences, not the fonts. |
| Why they collide | MIT governs the code; it says nothing about the fonts, which are redistributed under a different licence with a notice requirement the repo does not meet. |
| What breaks if ignored | A licence compliance failure on the published npm package and on the site, small but real, on a project whose About page is about credit. |
| Options | (a) `copy-fonts.mjs` copies each `@fontsource/*/LICENSE` into `fonts/` alongside the woff2 files and the package `files` list carries them; the About page's licence paragraph names the three faces and the OFL. (b) A `FONTS.md` at the repo root with the three notices, linked from the README. (c) Both. |
| Recommendation | (c). Also record that the brief's "variable subset font" is not the better choice here: three families as variable fonts would exceed the 130 kB budget the static instances sit under by 14 kB. |

### X-08. One token file in name; three palettes in practice

| | |
|---|---|
| Constraint A | Brief Phase 5: "one token file (`tokens.json` plus generated CSS custom properties) as the single source of truth for site, extension, and docs." |
| Constraint B | `tokens.json:2`: "The same values as tokens.css... Kept in step by test/contrast.test.ts". Neither generates the other. `packages/ui-hint/src/index.ts:47-118`: every colour as a hex literal, both themes, copied by hand. `apps/cli-ts/src/output.ts:15-21` and `apps/cli-py/src/betteruseofai/cli.py:276`: ANSI green and yellow chosen independently of any token. |
| Why they collide | A test keeps two files equal; it does not keep four surfaces equal. A palette change lands in the tokens and the hint keeps the old hex. |
| What breaks if ignored | The hint, which lives inside other people's pages and is the most-seen surface, drifts from the popup a few pixels away. |
| Options | (a) Generate `tokens.css` from `tokens.json` with a small script in `packages/tokens/scripts`, and have `ui-hint` build its style string from `tokens.json` at build time. Add a `terminal` block to `tokens.json` mapping roles (dim, emphasis, caveat, good) to ANSI 16-colour indices, and have both CLIs read it (the Python side already vendors the dataset the same way). (b) Keep both hand-written, extend the test to parse the hint's style string. (c) Leave it. |
| Recommendation | (a). The terminal block also answers the brief's colour-blind question in one place: the CLIs use green for figures and yellow for caveats, never red against green, and the mapping should say so. |

### X-09. Terminal rules: `NO_COLOR` ignored, session report 35 lines

| | |
|---|---|
| Constraint A | Brief Phase 5: "graceful degradation to plain ASCII under `NO_COLOR` or a non-TTY. Session summary in six lines or fewer. Do not port web visuals into the terminal." |
| Constraint B | `apps/cli-ts/src/context.ts:83` and `cli.py:206`: colour is off for `--no-color` or a non-TTY only; the `NO_COLOR` environment variable is never read. `--ascii` exists (`help.ts:39`). The `session` command prints 35 lines against the fixture logs (readouts, a model table, the heaviest turns, caveats, and "why the figures are uncertain"). The `Stop` hook's `systemMessage` is one line (`statusline.ts:264-266`), and the status line is one line. |
| Why they collide | `NO_COLOR` is a convention the brief names and the tools skip. The six-line rule and the 35-line report are two different things called by the same name: the report is the post-hoc account `PLAN.md:19` asked for, and its caveats are the honesty the whole project rests on. |
| What breaks if ignored | Users who set `NO_COLOR` get escape codes. Cutting the report to six lines removes the caveats, which is the one thing `commands/report.md:17-19` says never to do. |
| Options | (a) Honour `NO_COLOR` in both languages and add a parity case. Treat the hook line and the status line as the six-line summary the brief wants, and keep `session` as the long form. (b) Add `--brief` to `session` printing six lines: three readouts, the top model, the turn count, the caveat count with a pointer to the full report. (c) Shorten `session` itself. |
| Recommendation | (a) and (b) together. On the brief's block meters and sparklines: recommend against sparklines. A one-line bar of a range with a hidden reasoning floor invites reading the bar as the value; the bracketed `[ low to high ]` text is the honest shape. A single block meter for the top model's share is fine under `--ascii` fallback. |

### X-10. Three repository slugs and two abbreviations

| | |
|---|---|
| Constraint A | The GitHub organisation `betteruseofai` does not exist yet (`CLAUDE.md`, inputs owed). |
| Constraint B | `Footer.astro:36`, `github.ts:16`, `_redirects:1`, `install.astro:33`: `betteruseofai/betteruseofai`. `apps/claude-code-plugin/README.md:11`: `gordianknot-legacy/better`. `PLAN.md:66`: `betteruseofai/better`. Abbreviations: `buoa-` on every CSS class, `BUOA_*` on every env var, `<buoa-hint>`; `BUAI` on the Vale style (`styles/BUAI`, `.vale.ini:10`, `Vocab = BUAI`). |
| Why they collide | Three slugs cannot all resolve. Two abbreviations for one name reads as two projects. |
| What breaks if ignored | The plugin README's install command works today (the fork exists) and the site's links do not (the org does not). After the org is created the reverse is true unless someone remembers to change one file. |
| Options | (a) Standardise on `betteruseofai/betteruseofai` now in every file, including the plugin README, and note that it goes live when the org does. Rename `styles/BUAI` to `styles/BUOA` and the vocab with it: eleven `link:` lines and two `.vale.ini` lines. (b) Standardise on `buai` in code instead. Touches every class in every surface. (c) Leave both. |
| Recommendation | (a). |

### X-11. Documents describing a repo that has moved on

| | |
|---|---|
| Constraint A | `CLAUDE.md`: "Read `PLAN.md` before touching anything here." `PLAN.md` is the approved plan and the Vale config exempts it from edits made to pass lint (`.vale.ini:37`). |
| Constraint B | `PLAN.md:79,206` Astro 5 (Astro 7 built). `PLAN.md:76` Commander (hand parsing). `PLAN.md:75` uPlot (divs). `PLAN.md:146` Big Shoulders not in the extension (it is). `PLAN.md:200` names `Hairline`, `Ticker`, `PostCard`, `AuthorCard` components that were never built. `PLAN.md:224` promises proof-point range bars, a recommender screenshot and a page-weight ticker on the landing; none exist. `PLAN.md:82` names workflows `site.yml`, `release.yml`, `snapshots.yml`; the repo has `copy.yml` and no release or snapshot workflow. `docs/toolchain.md:15` names `site.yml`. `docs/STYLE.md:50,53` name `scripts/copy-lint.ts` and say the Vale rules have not landed. `apps/site/README.md:39` says 2.4 kB of landing script; it is 7.3. `apps/extension/README.md:38-39` says Manifest V2. `CLAUDE.md` deviation 18 says the JS budget is 150 kB; `site.test.ts:313` enforces 25 kB. |
| Why they collide | The plan is treated as read-only history and the deviations list in `CLAUDE.md` is the change log, but readers of the plan alone are misled, and `CLAUDE.md` is gitignored so contributors never see the deviations at all. |
| What breaks if ignored | A contributor follows the plan and builds Commander into the CLI. The 150 kB figure gets quoted as the budget when the enforced one is 25. |
| Options | (a) Add a short "Where this plan has been superseded" table at the top of `PLAN.md` pointing at each deviation, and fix the four docs with wrong file names and numbers. Keep the test at 25 kB and record that the lift to 150 was never needed. (b) Move the deviations list out of the gitignored `CLAUDE.md` into a tracked `docs/DECISIONS.md`. (c) Rewrite the plan in place. |
| Recommendation | (a) and (b). The plan stays as the record; the decisions file becomes the public change log the brief's readers can find. |

### X-12. Quantified claims that need a source, a qualifier or a computed value

| | |
|---|---|
| Constraint A | Brief: "No claim on the landing page that isn't backed by something in the repo. Cite the file." `docs/STYLE.md:40`: "Every number in published copy sits next to a source chip or a link to one." |
| Constraint B | Six findings. (1) `about.astro:37-38` "a few hundred times": true only against a local 8B model (295 times, parametric row, itself "about a third low" per `methodology.astro:294-296`); the small hosted model is 8 times (`frontier-by-default.md:11`). No chip. (2) `index.astro:107` links the Google chip to `https://cloud.google.com/blog`; the dataset row links `https://arxiv.org/abs/2508.15734`. (3) `options/App.tsx:60-61` "a factor of thirty" rests on rows of which 18 of 21 are `recalled-pending-refetch` (`packages/dataset/CHANGELOG.md:17-19`). (4) `popup/App.tsx:108` and `dashboard/App.tsx:143` type "seventeen years old" by hand; wrong on 1 January 2027. (5) The CLI `summary` prints "about 2.4 full smartphone charges" and "about 1.6 smartphones charged from empty" in one list; one is energy at 19 Wh a charge, one is carbon at 12.4 g a charge. The calculator groups these by quantity for exactly this reason (`Calculator.tsx:441-444`); the CLI does not. (6) `README.md:36-43` states the 170 times figure with no link to the method page. |
| Why they collide | The copy lint checks pages that print readouts (`copy-lint.mjs:108-115`); numbers written as words in prose escape it, and so do numbers inside the extension. |
| What breaks if ignored | The About page, the one place a sceptical reader goes to decide whether to trust the project, carries the one unsourced comparison on the site. |
| Options | (a) About page: "eight times against a small hosted model, and a few hundred against a small model on your own machine", with a link to the calculator preset that shows it. Landing chip: read the URL from the dataset row rather than typing it. Options page: "about thirty" and no change until the Ember refetch lands. Popup and dashboard: compute the age from the dataset year. CLI: group equivalents by quantity as the calculator does. README: link the method page. (b) Remove the About comparison. (c) Leave and note. |
| Recommendation | (a). Also extend `copy-lint.mjs` to flag spelled-out multipliers ("times", "factor of") in prose on a page with no chip, so this class cannot recur. |

### X-13. The one third-party request against "no third-party requests"

| | |
|---|---|
| Constraint A | Brief: "Privacy-first / no third-party requests vs. Google Fonts, CDN-hosted icons, analytics, stock imagery." |
| Constraint B | `CLAUDE.md` rule 2 permits exactly one: the Cloudflare beacon, manual snippet, disclosed. `privacy.astro:55-65` names its URL and what Cloudflare receives. `_headers:2` allows only that host for scripts. No fonts CDN, no icon CDN, no imagery of any kind. `site.test.ts:293-307` asserts zero outbound requests from the calculator page. |
| Why they collide | They do not, once the exception is written down, which it is in three places. Recorded because the brief asked for the list. |
| What breaks if ignored | Nothing. |
| Options | Keep. Or drop the beacon entirely, which removes the only third-party script and the only reason for `connect-src 'self'`. |
| Recommendation | Keep as is; it was a decision on 2026-09-10. The metastrip's "Telemetry: none" is true of the tools and should say "site analytics: one beacon, see privacy" on the website, or it reads as a claim about the page it sits on. |

### X-14. Reduced motion and the still frame; the missing toggle; `document.hidden`; layout per frame

| | |
|---|---|
| Constraint A | Brief Phase 4: reduced motion "gets a fully composed static composition that is beautiful in its own right. Design that still frame first... Not the animated version with motion stripped." "A visible low-energy / still-mode toggle, with the choice remembered." "Everything pauses on `document.hidden`." "Transform and opacity only, no layout thrash." |
| Constraint B | `dither/index.ts:225,235`: the held frame is `HOLD_NATURE + DISSOLVE * 0.5`, the midpoint of the first dissolve, where `churn` peaks at 0.85 (`index.ts:61`). That is the noisiest frame in the sequence, chosen because it shows the mechanism, not because it is composed. No toggle exists; only the OS setting is read. No `visibilitychange` listener; the loop relies on the browser throttling `requestAnimationFrame` in hidden tabs. `index.ts:163` writes `--swell` every frame; `global.css:500,519-520,550,557` derive `--reach`, the mask, the caption's `top` and opacity from it, so every frame changes an absolutely positioned element's `top` (layout) and a `mask-image` (paint). |
| Why they collide | The reduced-motion path was built as "stop the clock" rather than "show the designed still". The toggle and the explicit pause are simply absent. The per-frame layout is small (one small element) but it is layout. |
| What breaks if ignored | A reader with reduced motion set gets a screen of half-dissolved noise behind the headline, which is the failure case the brief describes. Nobody without the OS setting can stop the backdrop. |
| Options | (a) Design the still: hold on a fully resolved built field (mix 1, churn 0) of the pair whose composition sits best behind the headline, or a composed two-field split. Add a "Still" toggle beside the theme toggle, remembered in `localStorage` under a second disclosed key, which also stops the clock and holds the same still. Add a `visibilitychange` listener that stops and restarts. Move the caption to a `transform: translateY()` driven by `--swell` and let the mask be the only per-frame paint. (b) Toggle only, no redesign of the still. (c) Leave. |
| Recommendation | (a). The still is a design task for Phase 4 and should be screenshotted at 1440 and 390 in both themes before the motion is touched. |

### X-15. Performance targets that nothing measures

| | |
|---|---|
| Constraint A | `PLAN.md:248`: LCP ≤ 1.5 s, CLS 0, Lighthouse mobile ≥ 98. `PLAN.md:260`: "Lighthouse CI budgets". Brief: LCP under 2.0 s on 4G, 60 fps on integrated graphics. |
| Constraint B | No Lighthouse configuration or run exists in the repo or in `.github/workflows`. `site.test.ts` measures bytes only. The canvas 2D fallback (`render.ts:267-296`) walks every cell in JavaScript on every frame: at `cell * 1.8` about 160 by 33 cells at 1440 by 300, roughly 5,000 cells a frame, more at taller bands, with a `putImageData` each time. Frame rate not measured on either renderer. |
| Why they collide | Targets that are never measured are not targets. The fallback is the path a low-end machine takes, and it is the one doing per-cell work in JavaScript. |
| What breaks if ignored | A slow machine with no WebGL2 runs the heaviest code path at full frame rate on a page about frugality. |
| Options | (a) Add a Playwright trace of the landing page to `site.test.ts` that records LCP and frame timing on this machine, with a soft budget, and run Lighthouse once by hand before launch. Cap the canvas 2D fallback at 30 fps or, better, make it hold a still (it already lacks the fields' motion, so it is a slow cross-fade nobody needs). (b) Lighthouse CI in `copy.yml`. Adds a dependency and a flaky number to CI. (c) Leave. |
| Recommendation | (a). Turn the fallback into the still from X-14; a machine without WebGL2 is exactly the machine that should not be asked to animate. |

### X-16. Extension policy against the site's motion: they cannot share a runtime

| | |
|---|---|
| Constraint A | Brief: "Chrome MV3 CSP, no remote code, no inline script or `eval`, vs. whatever animation approach the site uses. The popup and the site probably cannot share a runtime. Say so plainly." |
| Constraint B | The site's backdrop is a WebGL2 canvas driven by a page script that Astro hashes into a per-page policy (`astro.config.mjs:27-63`, `site.test.ts:212-243`). The extension's pages are Preact with no inline script and no remote code (`wxt.config.ts:16-17`); the built manifest declares no `content_security_policy`, so the MV3 default applies. |
| Why they collide | They already do not share a runtime, and should not. A 360 px popup that starts a shader on every open is the wrong signal on a tool that measures compute. What they share is `tokens.css` and `components.css` (`components.css:4-6`), and that is the right boundary. |
| One thing to check | The composer hint injects a `<style>` element into a shadow root inside the host page (`ui-hint/src/index.ts:159-160`). In Chrome, inline styles inserted by a content script are subject to the host page's `style-src`. The end-to-end fixtures serve page shells without a policy header (`PLAN.md:257`), so a host that ships a strict `style-src` would silently show an unstyled hint and the tests would not notice. Firefox exempts content-script styles. |
| Options | Record the boundary in `BRAND.md`. Add one e2e case that serves a shell with `style-src 'self'` and asserts the hint still renders, or switch the hint to `adoptedStyleSheets`, which the page's policy does not govern. |
| Recommendation | Record, and add the e2e case. `adoptedStyleSheets` is the fix if it fails. |

### X-17. Files the brief expects that the repo lacks

| | |
|---|---|
| Constraint A | Brief Phase 1 lists `CODE_OF_CONDUCT`, `SECURITY`, and `.github/` templates among the files to read. `PLAN.md:119`: "`docs/dataset-contributing.md` and a PR template make rows community-editable." |
| Constraint B | None of `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE.md` or `.github/ISSUE_TEMPLATE/` exists. |
| Why they collide | The plan promised the PR template; the others were never planned. A security policy matters for a tool that wraps `fetch` inside other people's pages. |
| What breaks if ignored | Contributors have no checklist for a dataset row, and a researcher who finds an interception bug has no address to write to. |
| Options | (a) Add `SECURITY.md` (how to report, what is in scope, the no-network claim as the thing most worth testing) and a PR template carrying the attribution rule and the dataset-row checklist from `docs/dataset-contributing.md:8-34`. A code of conduct is a decision for the owner; the Contributor Covenant is CC BY 4.0 and compatible, and its register is warmer than `STYLE.md`, which is acceptable for a conduct document and would fail Vale. (b) Only the PR template. (c) None. |
| Recommendation | (a) for `SECURITY.md` and the PR template. Ask on the code of conduct. |

### X-18. The mark in a dark toolbar

| | |
|---|---|
| Constraint A | Brief Phase 3: the mark must survive "a Chrome toolbar on both light and dark themes." |
| Constraint B | The SVG marks use `currentColor` (`build.mjs:123`), which is right for the site. Manifest icons are PNG with fixed colours, and Chrome has no theme-aware icon field. Firefox has `theme_icons` in `browser_specific_settings`. `--ink` (`#14201a`) is invisible on a dark toolbar; `--bg` is invisible on a light one. |
| Why they collide | One PNG cannot be both. |
| What breaks if ignored | The extension's icon vanishes for every user on one of the two toolbar themes. |
| Options | (a) A mid-tone icon colour that reads on both: `--muted` (`#5b665f`, or `#5a655e` after X-04) has 5.07 against the light ground and about 7 against `#2b2b2b`, a typical dark toolbar. Use it for Chrome; give Firefox `theme_icons` with ink and paper variants. (b) Accent green on both. Reads on both, but every toolbar icon in green is a brand cliché the rule set exists to avoid. (c) Draw the mark on a filled square tile so the tile carries the contrast. Loses the open-grid quality at 16 px. |
| Recommendation | (a), and verify by screenshot in both toolbar themes before the route is chosen; a mid-tone mark may favour one route over another at 16 px. |

### X-19. Onboarding, and the one number a user sees most

| | |
|---|---|
| Constraint A | Brief Phase 5: "first-run onboarding"; "the one number a user sees most should be unmistakable." |
| Constraint B | The popup's first run is a standby block (`popup/App.tsx:69-80`) with no step to set a region, and region is the setting that moves carbon by a factor of thirty (`options/App.tsx:60-61`). The popup, the dashboard, the landing page and the CLI all show three equal readouts (energy, water, carbon); nothing leads. The landing headline is about water (`index.astro:36`). |
| Why they collide | The brief asks for a hierarchy the system has deliberately avoided: three quantities given equal weight because the project refuses to pick a favourite (`index.astro:118-121`). |
| What breaks if ignored | A first-run user gets a world-average carbon figure that may be wrong for them by a factor of thirty, with no prompt to fix it. Glanceability suffers when three equal numbers compete. |
| Options | (a) A one-step first run in the popup: "Where are you?" with the region list and a "world average for now" escape, nothing else. For hierarchy, lead with energy in the popup (it is the measured quantity; water and carbon are derived from it) and keep the three equal on the site and in the CLI, where there is room. (b) Lead with water everywhere, to match the headline. (c) Keep three equal everywhere. |
| Recommendation | (a). Decision needed: which quantity leads in the popup. |

### X-20. The gradient rule and its self-declared exception

| | |
|---|---|
| Constraint A | `tokens.css:7-8`: "nothing is a gradient, apart from the one hazard stripe." `contrast.test.ts:166-171`: the only gradients are the hazard hatching. |
| Constraint B | `global.css:529-539`: a linear-gradient scrim, with the comment "this is the one exception the rule already carves out". `global.css:519-520`: a gradient mask. `components.css:101-108`: the paper grid is a `repeating-linear-gradient` too, counted by the test as hatching. |
| Why they collide | The rule carves out one exception and the CSS claims a second in its own comment. The test cannot see it because it only reads `components.css`. |
| What breaks if ignored | The rule is decorative. |
| Options | (a) Amend the rule to say what is actually true: no colour gradients; hatching, grid rules and readability scrims are permitted because they carry structure or legibility, not decoration. Extend the test to `global.css`, with an allow list of the three. (b) Replace the scrim with a solid `--bg` panel behind the headline at partial opacity. Loses the fade into the field. (c) Leave. |
| Recommendation | (a). |

### X-21. "We send about" on the landing sentence

| | |
|---|---|
| Constraint A | `docs/STYLE.md:9`: "First person plural, 'we'." `VOICE.md:57`: "The site is 'we' and present tense." Throughout the site "we" is the project. |
| Constraint B | `index.astro:39`: "We send about [20] prompts a day to [a frontier model] from [the world average grid]." Here "we" is the reader. `PLAN.md:224` wrote it as "I send about". |
| Why they collide | One pronoun with two referents on one page. Two paragraphs later "we show the whole spread" is the project again. |
| What breaks if ignored | The reader wonders whose prompts are being counted. |
| Options | (a) "I send about", as the plan had it. (b) "You send about". (c) "Say you send about". |
| Recommendation | (a). It is the reader's sentence, spoken by the reader. Decision needed, since it is a copy rule. |

---

## Decisions this document is waiting on

1. X-01: bound the backdrop to one pass and print its cost, or leave it looping.
2. X-02: keep the four-pair hero and add still compositions for cost and recovery, or rebuild to the brief's chain. Does the hero end on traces or on a prompt box?
3. X-03: one hue with the brief's palette mapped onto it, or a second hue for water.
4. X-06 and X-18: which route, A, B or C, after seeing each at 16 px in mid-tone on both toolbar themes.
5. X-09: `--brief` on the session report, and no sparklines.
6. X-10: `betteruseofai/betteruseofai` everywhere, and `BUOA` for the Vale style.
7. X-11: a public decisions file, and the plan left as the record with a pointer table.
8. X-17: a code of conduct, yes or no.
9. X-19: which quantity leads in the popup.
10. X-21: "I send", "You send", or as it stands.

Everything else in Part 2 has a recommendation that does not need a decision to proceed, and none of it has been started.
