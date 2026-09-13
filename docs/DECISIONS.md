# Decisions, and where the plan was superseded

> The public record of where the built work departs from `PLAN.md`, and why. The plan stays as it
> was written on 2026-09-10; this file is the change log against it. Newest at the bottom.

## Deviations from the plan, all deliberate

1. **pnpm** was installed with `npm i -g pnpm@10`, not corepack, which needs administrator rights on
   the machine the plan was written on.
2. A **`per-prompt` benchmark row may carry `directWaterMl` and `directCarbonG`.** Without that the
   Mistral life-cycle row cannot be represented, because Mistral published carbon and water per
   reply but no energy.
3. **`proxy` is a fifth benchmark shape** rather than a duplicated payload, and rows carry an
   explicit `hosting` field rather than the engine inferring it from PUE.
4. **Six font faces, not nine.** All nine came to 155 kB against the 130 kB budget. Big Shoulders
   700 and Schibsted Grotesk 500 were dropped; real italic was kept.
5. **The design sheet** lives at `packages/tokens/design/index.html` as standalone HTML and becomes
   the site's `/design` route from the same CSS.
6. **Arguments are parsed by hand**, not with Commander, so the help text follows the copy rules and
   the Python tool can mirror it exactly.
7. **The dataset hash covers raw file bytes** rather than a re-serialisation, because JavaScript
   writes `1.17e-6` where Python writes `1.17e-06`. `apps/cli-py/scripts/sync-dataset.py` recomputes
   it and refuses to build on a mismatch.
8. **The `watch` command is not built.** It lands with the extension.
9. **Both tools carry a `recommend` command**, which the plan did not list, so the recommender sits
   inside the parity harness.
10. **The extension reads the o200k rank table from a packaged file** rather than bundling it. A
    service worker is one file; the lazy import was flattened and the worker hit 2.49 MB. It is
    under 200 kB now, and `apps/extension/test/no-network.test.ts` holds the allow list for that
    fetch.
11. **Firefox is built as Manifest v3**, not the v2 the build tool defaults to.
12. **The extension's end to end run is a separate task** from the unit tests, because sharing a
    machine made it flake about one time in four.
13. **The recommender runs with a higher bar inside a coding session**, and three rules are muted
    there: `no-llm.arithmetic`, `no-llm.unit-conversion` and `downgrade.short-simple`.
14. **Astro 7, not Astro 5.** The plan was written on 2026-09-10 and Astro was two majors past it by
    the time the site was built.
15. **Vale does not lint `.astro`.** `apps/site/scripts/copy-lint.mjs` runs Vale over text extracted
    from the built pages instead, which checks the words a reader sees.
16. **`Provenance` is a type in core.** The dataset schema had required it from the start; the
    TypeScript interfaces never carried it.
17. **The landing page does not import the dataset.** The engine runs at build time over the
    combinations its sentence offers and the page ships a small table.
18. **The landing headline has an animated backdrop**, which the plan did not call for: a generated
    tree dissolves through ordered dither into a circuit. Agreed on 2026-09-12. The landing script
    budget was lifted to 150 kB that day and the lift was never needed; the enforced budget stays at
    the plan's 25 kB and the page ships about 8 kB.
19. **The backdrop is a hand-written WebGL2 fragment shader with a canvas 2D fallback**, not a
    library. Three.js would have been 600 kB of scene graph for one full-screen quad.
20. **Four paired dissolves rather than one:** canopy to rack, river to coolant, soil to wafer,
    roots to fibre, sharing a composition so each has something to land on.
21. **Progress follows native scroll in a passive listener**, not a CSS scroll timeline, which
    cannot drive a canvas and leaves Firefox on a static frame.
22. **No uPlot, no chart library in the extension** (`PLAN.md:75`). The dashboard's bars are divs.
23. **Big Shoulders is loaded in the extension** (`PLAN.md:146` said not, for weight). Inside a
    packaged extension the weight argument is moot, and the brand line needs the face.
24. **`Hairline`, `Ticker`, `PostCard` and `AuthorCard`** (`PLAN.md:200`) were never built as
    components. The hairline is a class, the ticker became the page-weight item in the metastrip,
    and the blog list and About page carry their content inline.
25. **The workflows are `ci.yml`, `copy.yml`, `dataset-links.yml`, `e2e.yml` and `parity.yml`**
    (`PLAN.md:82` named `site.yml`, `release.yml` and `snapshots.yml`). Superseded by entry 41:
    `release.yml` and `snapshots.yml` now exist.

## The design audit of 2026-09-12

`CONFLICTS.md` at the repository root is the audit; `docs/design/BRIEF.md` is the brief it ran
against. The decisions taken on it, on 2026-09-13:

26. **The abbreviation in code is `buai`**, matching the Vale style, everywhere: class names,
    environment variables, the custom element and the events between page and extension. The
    repository slug is `betteruseofai/betteruseofai` in every file and goes live when the
    organisation does.
27. **`tokens.json` is the single source.** `tokens.css` and the composer hint's palette are
    generated from it, both command line tools read its terminal block, and the test regenerates
    the CSS and fails on drift. `--muted` moved from `#5b665f` to `#5a655e` to clear 4.5 to one on
    the accent tint.
28. **One hue.** The brief's palette words map onto the existing tokens (`docs/design/BRAND.md`).
    Deep water is not added and iridescence is dither, not gradient.
29. **The gradient rule says what is true**: no colour gradients; the hatching, the paper grid and
    the landing scrim are named in `tokens.json` by file and count and the test counts them.
30. **The backdrop plays once** and ends on a ninth scene, the composer, then holds. That frame is
    also the reduced-motion, Still-toggle and no-WebGL2 frame. A Still toggle sits beside the theme
    toggle and is remembered. The rules are in `docs/design/MOTION.md`.
31. **The brief's cost and recovery moments are stills**, and recovery lives where a real saving
    exists: the extension dashboard, as rings, against the largest model in each family.
32. **The fonts ship with their OFL licence text** beside them, and `FONTS.md` carries the notice.
33. **`NO_COLOR` is honoured** in both tools, and `session --brief` prints six lines with a block
    meter; the full report is unchanged. The brief form is the first text case in the parity
    harness.
34. **The CLI's everyday comparisons name their quantity**, and stale-figure ages are computed from
    the source date everywhere they appear.
35. **The popup leads with energy** and the first run asks one question, where you are, once.
36. **The composer hint uses an adopted stylesheet.** Probed in the end to end run: an inline style
    element under a strict host `style-src` is blocked in Chromium.
37. **Every page prints its own weight** over the wire, computed after the build by the same
    arithmetic as the budget test.
38. **The mark is the die.** The three cell-grid routes of 2026-09-12 were judged not to help
    the brand. Three shape directions were drawn and direction B, a die with two corners
    chamfered into a leaf and veins that are also routing, was chosen on 2026-09-13. The
    icons for both browsers, the favicons, the lockups and the usage document are in
    `packages/tokens/logo/README.md`. The Chrome toolbar tone is a token, `icon.toolbar`, chosen
    to clear three to one on both toolbar colours and asserted by test.

39. **A code of conduct**, `CODE_OF_CONDUCT.md`, modelled on the Contributor Covenant 2.1 and
    rewritten in the project's voice, with the Covenant credited under CC BY 4.0. Asked for by
    the owner on 2026-09-13.

40. **The Writing page is a hub, not a blog.** The site's own two seed posts were removed; the
    people who make this publish on Substack, and the build reads each contributor's feed
    (`apps/site/src/loaders/substack.ts`, list in `src/data/substacks.json`, committed snapshot
    as the fallback, offline in CI) and ships the posts as plain text. Beneath them, the papers the
    dataset rests on, built from the benchmark rows' own citations so the list cannot drift from
    the method page, and a hand-kept list in `src/data/reading.json` for writing found elsewhere.
    The site's RSS feed and the `@astrojs/rss` dependency went with the posts; `/feed` now lands on
    the hub. Asked for on 2026-09-13.

41. **Release and snapshot automation.** `release.yml` runs on a `v*` tag: build, tests, parity,
    both extension zips with `SHA256SUMS` attached to a GitHub release, then npm and PyPI behind a
    `release` environment a person approves. `snapshots.yml` refreshes the three committed
    fallbacks weekly and opens a pull request. The plugin bundle is tracked in git, because a
    marketplace install cannot build, and CI fails when the committed bundle is not the one the
    commit builds. `docs/DEPLOY.md` is the launch checklist. Entry 25 is superseded on the two
    missing workflows.

42. **Sixteen region grid intensities are now read from Ember, not recalled.** Dataset 0.2.0. The
    world average and fifteen countries come from the Ember yearly CSV, central figure 2025 and a
    range from the last three years, provenance `fetched`. Several recalled figures were far off:
    the United Kingdom 124 against 217, Canada 120 against 191, Sweden 24 against 35. Grids differ
    by a factor of about twenty, not thirty, and the popup and options copy now say so. Two eGRID
    subregions stay pending; the owner declined the EPA download in this session.

43. **The two eGRID subregions are read from the EPA spreadsheet.** Dataset 0.3.0. California
    195.0 and Virginia and the Carolinas 270.5 gCO2e/kWh, both lower than recalled; the national
    row verified against the same sheet. No region row is recalled from memory any more.

44. **Off-site water per region, from WRI.** Dataset 0.4.0. Every region carried one water range
    built around a United States figure; each now carries its own consumption factor from the World
    Resources Institute guidance, cited in the row's `waterSource` beside the grid citation, with a
    0.7 to 1.5 band and a note saying why. Singapore, South Africa and the Google fleet take the
    global average with a half-to-double band, stated as the assumption it is. The method page shows
    the water citation beside the figure.

## Still open

- The tokenizer ratios, which need the providers' counting endpoints and so an API key, in
  `packages/dataset/CHANGELOG.md`.
- Release and snapshot automation, and the GitHub organisation, accounts and domain the plan lists
  as owed.
