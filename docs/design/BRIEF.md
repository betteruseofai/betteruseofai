# Design brief: brand, interface and landing page audit

> Status: working document. This is the brief the design audit runs against. It was written on
> 2026-09-12, after the first pass at the design system, the logo routes and the landing page had
> been built, so it reads as an audit of what exists rather than a plan for a blank slate.

## What this brief is for

Better Use of AI ships as a browser extension for the web LLM interfaces, a Claude Code plugin,
two command line tools, and a website at `betteruseofai.org`. We want one visual system across
all of it: the mark, the design language, the extension surfaces, the terminal output and the
landing page.

The repo already carries a first pass at most of this. `packages/tokens` holds the palette, the
type and the component CSS. `packages/tokens/logo` holds three routes for the mark. `apps/site`
holds the landing page and fifteen other pages. The job now is to audit that first pass against
the principles below, report where they collide, and change only what the report and the
subsequent decisions say to change.

## Settled before the audit began

| Question | Decision | Date |
|---|---|---|
| Tool name | Better Use of AI. Package and command name `betteruseofai` | 2026-09-10 |
| Repo | This repo, `better` | 2026-09-10 |
| Site stack | Astro 7, static, vanilla CSS with tokens, Preact islands where a page needs state | 2026-09-11 |
| Landing JS budget for the audit | 60 kB gzipped initial script | 2026-09-12 |
| Landing page budget for the audit | 400 kB total transfer | 2026-09-12 |
| Scope | Audit the existing system against this brief. Later phases change only what the Conflict Report and the decisions on it call for | 2026-09-12 |
| Where the audit lands | `CONFLICTS.md` at the repo root | 2026-09-12 |

The budgets above are looser than the ones `PLAN.md` set. The Conflict Report lists both and what
the landing page measures now, so the choice is made with the numbers in view.

## Phase 1: read before building. No code.

Read every markdown file in the repo, the licence, every package manifest, the plugin manifests,
the extension build config, the site config and headers, the workflows under `.github/`, and the
design tokens. Produce two documents inside `CONFLICTS.md`.

**Constraint Inventory.** Every stated or implied constraint, with its source. Cover stack,
dependencies, browser support, privacy, telemetry, licensing, performance, accessibility, brand,
tone, naming, and every quantified claim.

**Conflict Report.** A table with an ID, constraint A with file and line and a short quote,
constraint B likewise, why they collide, what breaks if the collision is ignored, two or three
resolution options with their trade-offs, and a recommendation.

Check these in particular, and keep going past them.

- **Animation against the tool's own thesis.** An animated hero has a per-visitor energy cost on
  a page that argues for compute frugality. The report takes an explicit stance, with the
  measured cost, rather than a quiet compromise.
- **Dependency rules against what the motion work needs.** Any "no library" or "no build step"
  rule, set against what the current backdrop and any proposed animation actually require.
- **Privacy against third parties.** The zero-telemetry rule set against fonts, icons, analytics
  and imagery. Every request the site makes, listed.
- **Extension content security policy against the site's motion.** Manifest v3 permits no remote
  code, no inline script and no `eval`. If the popup and the site cannot share a runtime, the
  report says so plainly.
- **Documented colours against WCAG 2.2 AA.** 4.5:1 for text, 3:1 for non-text and interface
  parts. Every pair in `tokens.json`, both themes.
- **Licence compatibility.** The repo's MIT licence set against every font, icon and library in
  use or proposed. Font licences differ from code licences.
- **Greenwashing.** Every quantified sustainability claim in the docs and the site, checked
  against the methodology the repo carries. A backed number links to its source. An unbacked
  number is softened or removed.
- **Naming and tone drift.** The tool called different things in different files. A style guide
  or code of conduct that sits badly with the marketing copy.
- **Accessibility against motion.** Reduced-motion handling, pause on hidden tabs, focus,
  keyboard reach and decorative SVG.

**Hard stop.** Print both documents and wait for decisions. No reasoning past a conflict alone.

## Phase 2: the concept

The idea to build around is the physical supply chain of computation, made visible. Silicon
begins as quartz sand. Fabs run on enormous volumes of ultrapure water. Data centres draw water
for cooling, land for footprint and power for both. Someone should be able to feel the line
running from forest, river and quartz, through wafer and rack, to the prompt they just sent, and
then see their own reduction measured against it.

**The one rule that matters.** Nature and silicon share a single geometry. Find forms that read
as both at once and let the eye flip between them. Dendritic branching that is also circuit
routing. Water ripples that are also lithography rings. Leaf venation that is also a die
floorplan. Tree rings that are also a concentric wafer map. A river delta that is also PCB
fan-out. A leaf sitting next to a chip is the failure case. The dual read is the identity.

Palette anchored in quartz and sand, wafer iridescence, pine and moss, and deep water, with one
warm tone reserved for high-impact states. No bright eco-green gradient. No AI-industry purple.

Illustration over photography. Vector, SVG or procedural, generated in the repo. No stock photos,
for licensing, weight and sameness. If a photograph proves unavoidable it is CC0, credited in a
`CREDITS.md`.

The landing page already dissolves a canopy into a rack, a river into coolant, soil into a wafer
and roots into fibre. The audit checks that work against this rule rather than assuming it passes.

## Phase 3: the mark

Hand-written SVG, never traced raster. Three routes already exist under `packages/tokens/logo`,
drawn as eight-cell grids from rules. The audit judges them against the following.

- Primary mark, horizontal lockup, stacked lockup, monochrome and reversed.
- Icons at 16, 32, 48 and 128 pixels for Manifest v3. Designed at 16 first. A concept that dies
  at 16 is the wrong concept.
- Survives a Chrome toolbar in both themes, a Unicode or ASCII reduction for the terminal, a
  circular GitHub avatar crop, and a README header.
- Grid, optical corrections, clear space and minimum sizes documented, with a usage `README.md`
  alongside the SVG.

If the report finds the three routes wanting, three new directions come as SVG with a one-line
rationale and a 16 pixel preview each, and work stops again before any of them is refined.

## Phase 4: the landing page

Astro 7, as built. Structure: hero, what a prompt actually costs, how it works, install surfaces
(extension, Claude Code, other agents), methodology and proof, community and contribution, footer.

**Three signature motion moments. Everything else stays still.**

1. **Hero.** One continuous morph through one line and shape system: quartz lattice, water ripple,
   wafer, die shot, server rack, then a cursor blinking in a prompt box. One substance being
   refined, never six scenes cross-fading.
2. **The cost.** A prompt is sent and the ripple travels back up the chain: water, land, watts.
   Restrained and factual. No doom, no guilt.
3. **The recovery.** The user's own saving rendered as regrowth: rings accreting, a delta
   refilling. Earned, never saccharine.

Technique: CSS transforms and opacity, SVG path morphing, `stroke-dasharray`, the Web Animations
API, and canvas only where it clearly wins. No animation library unless the Conflict Report has
proposed it with its size and licence first.

Budget and behaviour:

- At most 60 kB of initial script and 400 kB of total page weight. Largest Contentful Paint under
  2.0 s on 4G. 60 frames a second on integrated graphics.
- Transform and opacity only, so nothing thrashes layout. Nothing animates off screen. Everything
  pauses when the document is hidden.
- `prefers-reduced-motion: reduce` gets a fully composed still frame, designed first, that the
  motion moves into and out of. Never the animated version with the motion removed.
- A visible still-mode toggle whose choice is remembered. On this tool it is the thesis. The
  page's own measured transfer weight sits in the footer.
- Self-hosted subset fonts or a good system stack. No font CDN.
- Semantic HTML, keyboard reachable, visible focus, `aria-hidden` on decorative SVG, real alt
  text, dark mode.

## Phase 5: product surfaces

**Browser extension.** Toolbar popup, in-page hint on the LLM sites, options page, first-run
onboarding. The tone is an ambient meter, never a scold. Built for glanceability: the one number a
user sees most is unmistakable. Injected through Shadow DOM so host CSS cannot leak either way,
with zero layout shift on the host page and the host's light or dark state respected.

**Claude Code plugin and coding agents.** A terminal surface with its own rules. Restrained ANSI
and Unicode: block meters, sparklines, colour-blind-safe choices, plain ASCII under `NO_COLOR` or
without a TTY. A session summary in six lines or fewer. Web visuals are never ported to the
terminal.

**Across surfaces.** One token file, `tokens.json` with generated CSS custom properties, as the
single source of truth for the site, the extension and the docs.

## Deliverables

1. `CONFLICTS.md`, the Phase 1 output, before anything else.
2. `docs/design/BRAND.md`: concept, palette with contrast ratios, type scale, motion principles,
   do and don't.
3. `packages/tokens/logo/`: every SVG variant and the usage doc.
4. `tokens.json` and the generated CSS.
5. The landing page.
6. Extension interface and terminal output design.
7. `docs/design/MOTION.md`: for each animation, its purpose, trigger, duration, easing,
   reduced-motion fallback and measured cost.

## Working rules

- Stop after Phase 1. Stop again after any new logo directions. No building past either gate.
- Every colour pair introduced comes with its contrast ratio.
- Every dependency introduced comes with its size and licence.
- Anything in this brief that conflicts with the repo is raised, never chosen silently.
- No claim on the landing page that the repo does not back. Cite the file.
- The project's hard rules in `CLAUDE.md` and the copy rules in `docs/STYLE.md` still apply to
  every word and pixel this brief produces.
