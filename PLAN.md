# Better Use of AI — Implementation Plan

## 1. Context

A new open-source project at `betteruseofai.org`. It shows people how much water, energy and carbon their LLM usage consumes, with honest uncertainty ranges, and nudges them towards a smaller model, no model, or a local model when the frontier model is overkill. It exists because nobody using ChatGPT, Claude, Gemini or a coding agent today can see the resource cost of a conversation, and because the default model is almost always the most expensive one.

The working directory `C:\Users\LENOVO\argonauts\better` is empty. Everything below is greenfield.

## 2. Decisions settled with the user (2026-09-10)

| Area | Decision |
|---|---|
| Form factor | Monorepo: shared core library + browser extension + CLI companions + Claude Code plugin + website |
| Providers P1 | claude.ai, chatgpt.com, gemini.google.com (extension); Claude Code, Codex CLI (log readers); Claude Code statusline/hooks plugin; localhost LLM UIs |
| Providers P2 | Perplexity, Mistral Le Chat, Gemini CLI, Codex web |
| Providers P3 | Cursor, GitHub Copilot (best-effort, approximate) |
| Capture (web) | Intercept the page's own network calls (MAIN-world fetch/SSE wrapper) for model ID and text; DOM fallback via MutationObserver |
| Token estimation | Local only. Exact tokenizer for OpenAI (o200k); calibrated approximation for Anthropic and Google. Always labelled as estimates |
| Recommender | Local rule-based heuristics, transparent ("this rule fired"), pluggable for a future classifier. Tiers: Frontier → Smaller same-family → No model needed → Run locally. Surfaces as a dismissable pre-send hint AND a post-hoc session report |
| Presentation | Per conversation/session plus day/week/all-time; low/central/high ranges; real-world equivalents; region-aware carbon intensity |
| Privacy | Strictly local. Zero telemetry, no backend, no accounts, all processing client-side at all times. Benchmark data ships inside the packages |
| Local LLMs | Guide page; calculator compares cloud vs local; extension tracks localhost UIs; recommender has a "run locally" tier |
| Website | Astro static on Cloudflare Pages. Landing, Methodology, Calculator, Install, About (Anirudh Sharma is creator, GitHub `gordianknot-legacy`, affiliation TODO, build-time contributors list), Blog (MDX, RSS, tags, multi-author, 1–3 seed posts), Local LLM guide, Privacy, Changelog |
| Analytics | Cloudflare Web Analytics only (cookieless beacon), manual snippet, disclosed on the Privacy page. Nothing else |
| Design | Light-first. Warm off-white ground `#eeece9` (Brikken), single green accent, mono numerals, hard corners, "slightly dystopian" through type and copy. Dark theme secondary. No generic AI-site patterns |
| Copy | British English, first person plural ("we"), conversational, no AI-writing tells. **Blocked on voice samples from the user**; every page is draft until they review |
| Stack | TypeScript, pnpm + Turborepo, Vitest, WXT extension (Chrome + Firefox), Astro site, Preact islands. Python CLI with **full parity** to the TS CLI via shared golden fixtures |
| Distribution | Chrome Web Store, Firefox AMO, GitHub Releases zip, npm (`npx betteruseofai`), PyPI (`uvx betteruseofai`), Claude Code plugin marketplace in-repo |
| Repo / hosting | New GitHub org `betteruseofai` (name is free; user creates it), Cloudflare Pages, domain registered at Namecheap |
| Licence | MIT |
| Attribution | **No AI attribution anywhere.** Commit messages, PR descriptions, the website, README and package metadata must not name Claude, Fable, Opus or any AI model as author or co-author. No `Co-Authored-By` trailer for the assistant, no "Generated with" footer. This overrides the default commit attribution for this repo |
| Timeline | No deadline. Design system and benchmark dataset get full attention before UI |

### Inputs still needed from the user (do not block scaffolding)

1. **Voice samples**: 2–3 paragraphs of your own writing plus writers/sites whose tone you like. All copy stays `status: draft` until these arrive.
2. **Accounts**: GitHub org `betteruseofai` (add `gordianknot-legacy` as owner), Cloudflare account, Chrome Web Store developer account ($5), Firefox AMO account, npm org, PyPI project. All three names (`betteruseofai` on GitHub, npm, PyPI) were free on 2026-09-10.
3. **About page**: affiliation line and any links beyond GitHub.
4. **Namecheap**: change nameservers to Cloudflare when we reach deploy.

### Local machine state (checked 2026-09-10)

Present: Node 24.16, npm 11.13, Python 3.12 and 3.14, git 2.54, `gh` 2.92 on PATH (authenticated as `gordianknot-legacy`; the CLAUDE.md note that it is only at an absolute path is stale). Missing, to install in step 0: pnpm, uv, Vale, wrangler.

## 3. Load-bearing facts from research

- **Claude Code plugins cannot set `statusLine`**; only user/project settings can. The plugin therefore ships the script and a `/betteruseofai:setup` command that writes the settings entry with user confirmation.
- Statusline stdin JSON includes `transcript_path`, `session_id`, `model.id`, `context_window.*`, `cost.*`. Debounced 300 ms; the script must return in tens of ms, so it parses the transcript incrementally from a cached byte offset.
- Hooks available: `SessionStart`, `UserPromptSubmit` (can return `systemMessage`, shown to the user, not injected into model context), `Stop`, `PostModelSwitch`, `SessionEnd` (1.5 s budget, not used).
- Claude Code transcript lines: assistant messages carry `message.id`, `requestId`, `message.model` (can be `<synthetic>`), `usage.output_tokens_details.thinking_tokens` (nullable), `usage.inference_geo`. Same message id repeats across streaming chunks; dedupe on `message.id + requestId`, keep the last.
- Codex CLI: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (plus `archived_sessions/`). `turn_context` gives model; `event_msg` with `payload.type === "token_count"` gives `total_token_usage` and `last_token_usage` with `input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens, reasoning_output_tokens`. No token data before 2025-09-06.
- Gemini CLI (P2): `~/.gemini/tmp/<hash>/chats/session-*.jsonl` with per-message `tokens{input,output,cached,thoughts,tool}` and `model`; telemetry file is opt-in so we read chats.
- Web endpoints (re-verify during implementation, encode as fixtures): claude.ai `POST /api/organizations/{org}/chat_conversations/{uuid}/completion` with `model` in the body (sometimes absent → read the picker); chatgpt.com `POST /backend-api/f/conversation` with delta-encoded SSE, where the streamed `metadata.resolved_model_slug` names the model that actually answered (auto-routing means the request slug is not enough); gemini.google.com `POST .../BardFrontendService/StreamGenerate` carries the model in request header `x-goog-ext-525001261-jspb` (per gemini-webapi), so the interceptor reads the header and the DOM picker (Fast / Thinking / Pro) is the fallback.
- Agentic sessions dwarf chat prompts: Hausfather measured his own Claude Code sessions at 150–1,200 Wh per human prompt (median ~600 Wh, ~10M tokens/session), and Watershed's framework puts agentic workflows at 50–500 Wh. The CLI and plugin outputs must be framed accordingly (per session, not per prompt).
- Water figures differ by scope: Google reports on-site cooling only (0.26 mL); Jegham adds off-site electricity water at 4.35–5.11 L/kWh (roughly 10× the on-site term); Mistral's LCA adds embodied and amortised training water (45 mL). The engine therefore carries a **water-scope setting**: `on-site` | `on-site + off-site` (default) | `lifecycle`, and never mixes vendors' numbers without normalising.
- WXT: use `injectScript()` from the isolated content script for the MAIN-world interceptor (one code path for Chrome and Firefox). Firefox needs `strict_min_version: "128.0"`. `wxt zip -b firefox` also emits the sources zip AMO requires. `wxt submit` uploads to both stores.
- Tokenizers: `js-tiktoken/lite` + `ranks/o200k_base` as a lazy chunk. Claude tokenizes roughly 16% more tokens than o200k on English prose, 21% on maths, 30% on Python; Gemini is roughly o200k-comparable.
- Benchmarks disagree by an order of magnitude because of system boundary and model size: Google median Gemini Apps text prompt 0.24 Wh / 0.26 mL / 0.03 gCO2e; Altman's ChatGPT 0.34 Wh / 0.32 mL (unaudited); Mistral Large 2 LCA 1.14 gCO2e / 45 mL per 400-token exchange (lifecycle boundary, includes off-site water); Jegham et al. per-query measurements at three prompt sizes (GPT-4o 0.42→2.88 Wh, Claude 3.7 Sonnet 0.95→5.67 Wh, o3 1.18→12.2 Wh); EcoLogits parametric formula for open models. Grid intensity from Ember yearly data. See §11 for the full source appendix.

## 4. Monorepo layout

```
better/
├─ package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  .node-version (22)
├─ .changeset/   LICENSE (MIT)   .vale.ini   styles/BUAI/
├─ .claude-plugin/marketplace.json          # lets `claude plugin marketplace add betteruseofai/better` work
├─ packages/
│  ├─ dataset/      @betteruseofai/dataset    language-neutral JSON + JSON Schema → built TS + bundle w/ sha256
│  ├─ core/         @betteruseofai/core       isomorphic engine: resolve, normalise, estimate, aggregate, equivalents, format, recommender. No Node APIs
│  ├─ tokenizers/   @betteruseofai/tokenizers o200k lazy chunk + calibration. Kept separate so core stays ~30 KB
│  ├─ readers/      @betteruseofai/readers    Node-only log readers (Claude Code, Codex; Gemini CLI in P2)
│  ├─ tokens/       @betteruseofai/tokens     tokens.css, fonts.css, components.css, tokens.json (shared by site and extension)
│  └─ ui-hint/      @betteruseofai/ui-hint    framework-free <buoa-hint> web component for the composer hint
├─ apps/
│  ├─ extension/           WXT, Preact + signals, uPlot charts
│  ├─ cli-ts/              npm `betteruseofai`, single-file ESM via tsdown, Commander
│  ├─ cli-py/              PyPI `betteruseofai`, uv + hatchling, argparse (+ optional rich), ruff, pytest
│  ├─ claude-code-plugin/  hooks, statusline shim, commands, skill; invokes cli-ts build
│  └─ site/                Astro 5 static, Cloudflare Pages
├─ fixtures/               golden fixtures shared by TS, Python and extension tests (§9)
├─ docs/                   methodology.md, dataset-contributing.md, adapters.md, parity.md, STYLE.md
└─ .github/workflows/      ci.yml  parity.yml  e2e.yml  site.yml  dataset-links.yml  release.yml  snapshots.yml
```

Dependency direction: `dataset ← core ← tokenizers`; `readers → core`; `cli-ts → readers, core, dataset`; `extension → core, tokenizers, ui-hint, tokens`; `site → core, tokenizers, tokens`; `claude-code-plugin → cli-ts` (invokes, no dataset copy); `cli-py → dataset` (JSON vendored at build, sha256 asserted equal to the TS bundle).

## 5. Core library and dataset

### 5.1 Types (`packages/core/src/types.ts`)

- `Model { id, aliases[], provider, family, tier: frontier|mid|small|nano, ordinal, displayName, reasoning, thinkingRatio?: Range, activeParamsB?: Range, released?, deprecated? }`
- `Range { low, central, high }` everywhere a number appears.
- `BenchmarkRow { id, modelIds[], shape, waterOnsiteLPerKwh?, carbonGPerKwh?, embodiedShareOfTotal?, pue, methodology, boundary, source{title,url,publisher,date,retrieved,doi?}, validFrom, validTo?, qualityScore 1–5, notes? }`
  - `shape` is one of four kinds: `per-token`, `per-prompt` (with reference token counts), `per-query-set` (Jegham-style points at several prompt sizes; fitted to slope + intercept), `parametric` (EcoLogits-style from active params).
  - `methodology`: provider-measured | provider-statement | independent-benchmark | parametric-model | proxy. `boundary`: accelerator-only | server | datacenter | lifecycle.
- `Region { code (ISO-2, WORLD, or provider fleet), gridGco2PerKwh: Range, waterOffsiteLPerKwh: Range, source, year }`
- `TokenCounts { input?, output?, cachedRead?, cachedWrite?, thinking?: number|null, tool?, estimated, estimator }`. `null` thinking means "model may think, count unknown"; `undefined` means the model cannot think.
- `UsageEvent { id, surface, hosting: cloud|local, modelRaw, modelId|null, tokens, timestamp, conversationId?, sessionId?, regionHint?, promptPreviewHash?, meta? }`. Prompt text is never stored.
- `Estimate { eventId, modelId, datasetVersion, energyWh, waterMl, carbonG: Range, basis{ benchmarkRowId, methodology, regionCode, tokens, thinkingHandling, flags[] } }` with flags `model-unknown | tokens-estimated | thinking-unknown | proxy-row | region-default | input-partial`.
- `Aggregate { key, from, to, count, energyWh, waterMl, carbonG, bySurface, byHosting, unknownModelCount }`.

### 5.2 Functions (`packages/core/src/index.ts`)

`resolveModel(raw)`, `selectBenchmark(model, at, dataset)`, `normalizeToPerToken(row)`, `estimate(event, {region, dataset})`, `aggregate(estimates, bucket)`, `equivalents(x)`, `formatRange(r, unit)`, `createRecommender(opts)`, `DATASET_VERSION`.

### 5.3 Normalisation rules (`packages/core/src/normalize.ts`) — where "absence never renders as zero" lives

- per-prompt rows → per-token by attributing energy to reference tokens with an output:input weight `k` in [4, 15] (central 8); result flagged `derived` and widened ×0.5 / ×2.
- per-query-set rows → least-squares `wh = a + b_in·in + b_out·out`; the intercept `a` is charged once per event.
- parametric rows → EcoLogits formula from active params; input at `1/k`.
- Cached reads charged at `{0, 0.1, 0.5}` × input rate (no public data). Cache writes as input.
- Missing thinking on a reasoning model: low = 0, central = output × thinkingRatio.central, high = output × thinkingRatio.high; flag `thinking-unknown`; UI shows "≥ X Wh (hidden reasoning not disclosed)".
- Unknown model → no numbers, `unknownModelCount++`, UI shows "unknown".
- Water = energy × (row on-site WUE + region off-site water when scope ≥ `on-site + off-site`) + embodied water when scope = `lifecycle` and the row has it. Carbon = energy × (row market-based intensity only if the user explicitly picks "provider-reported", else the region's location-based grid factor; default is location-based because market-based factors such as Google's 94 gCO2e/kWh flatter by 3–4×). Embodied share is a separate toggle.
- Web-app input is a lower bound (system prompts invisible); per-surface hidden-context factor widens `high`, e.g. chatgpt.com `{1.0, 1.5, 3.0}`.

### 5.4 Dataset (`packages/dataset/`)

`data/models.json`, `data/benchmarks.json`, `data/regions.json`, `data/equivalents.json`, `data/calibration.json`; `schema/*.schema.json` (JSON Schema 2020-12); `CHANGELOG.md`; `scripts/build.ts` validates with ajv plus custom checks (`low ≤ central ≤ high`, model references exist, unique ids) and emits `dist/index.js`, `dist/index.d.ts`, `dist/dataset.json` with version and sha256. A weekly CI job link-checks every `source.url`. `docs/dataset-contributing.md` and a PR template make rows community-editable. Data-only change = minor bump; schema change = major.

Initial rows (P1): Google 2025 median (Gemini 2.5 Flash / Apps default); Altman 0.34 Wh for the GPT-5 family as `provider-statement` with a wide range; Jegham per-query-set rows for GPT-4o, GPT-4.1, o3, Claude 3.7 Sonnet, plus `proxy` rows mapping Claude 4.x and Opus by tier factor; EcoLogits parametric rows for Llama, Qwen, Mistral open models (these double as the local rows with `pue: 1.0`); Mistral Large 2 LCA. Every row must be verified against its source during implementation; see §11.

Equivalents: LED bulb seconds (10 W), phone charges (12 Wh), teaspoons (4.9 mL), 500 mL bottles, metres driven by an average EU petrol car, one Google search (0.3 Wh, 2009 figure, flagged as old). `equivalents()` picks the one or two whose value lands between 0.1 and 100.

### 5.5 Tokenizers (`packages/tokenizers/`)

`estimateTokens(text, provider)` async (lazy o200k chunk) and `estimateTokensSync` (chars-per-token, ±25%). OpenAI exact. Anthropic = o200k × per-content-class calibration `{prose 1.16, maths 1.21, code 1.30, non-Latin 1.10}` as ranges. Google = o200k × `{0.95, 1.0, 1.10}`. A developer-only script `scripts/calibrate.ts` (never shipped) refreshes factors against provider count-token APIs. Every estimated count carries `estimated: true`, rendered with "~" and a tooltip.

### 5.6 Recommender (`packages/core/src/recommender/`)

`Rule { id, version, kind: no-llm|downgrade|local|keep, evaluate(ctx): RuleResult|null }`. `features.ts` extracts regex-only features in under 2 ms: word/char counts, code likelihood, arithmetic expression (safe mini-grammar), unit-conversion match, imperative verb (rewrite, summarise, translate, fix grammar, extract, classify), reasoning cues, constraint count, conversation depth.

Initial rules: `no-llm.arithmetic` (0.95, includes the local answer), `no-llm.unit-conversion` (0.9), `no-llm.date-math` (0.8), `no-llm.simple-lookup` (0.6), `downgrade.short-simple` (0.7), `downgrade.rewrite-task` (0.8), `downgrade.summarise` (0.75), `downgrade.translate` (0.8), `downgrade.classify-extract` (0.7), `downgrade.no-reasoning-cues` (0.55, report only), `local.small-task` (0.6, only if the user says they have a local model), and veto rules `keep.deep-reasoning`, `keep.long-code`, `keep.multi-step`. Vetoes with confidence ≥ 0.7 block downgrade/local and are recorded as `vetoedBy`. Pre-send hint threshold 0.6; report threshold 0.45. Target = one rung down the family ladder from `dataset` ordinals. `estimatedSavings` = estimate(current) − estimate(target). Explanation: "Rule downgrade.rewrite-task fired: starts with 'rewrite'; 87 words; no code". `createRecommender({ classifier })` is the ML hook, blended as one more rule.

## 6. Extension (`apps/extension/`, WXT)

- Entrypoints: `background.ts`; isolated content scripts `claude.content.ts`, `chatgpt.content.ts`, `gemini.content.ts`, `localwebui.content.ts`; unlisted `interceptor.ts` injected into MAIN world via `injectScript()` at `document_start` with a per-page nonce; `popup/`, `options/`, `dashboard/`.
- `src/adapters/types.ts` defines `SiteAdapter { id, matches, hosting, version, main{shouldCapture, parseRequest, parseStream, finalize}, dom{conversationIdFromUrl, observeMessages, readSelectedModel}, composer{findComposer, readDraft, anchorForHint}, healthProbe }`. One folder per site plus `local/{openwebui,lmstudio,ollama-ui}`.
- Pipeline: MAIN wraps fetch/XHR/EventSource, tees the response, parses SSE, dispatches a nonce-guarded CustomEvent → isolated script validates with zod and forwards `turn:captured` → background resolves the model, lazily counts tokens, runs `estimate()`, writes to IndexedDB, broadcasts to popup/dashboard. DOM fallback emits `turn:dom` if no MAIN turn arrives within 5 s of a new message pair; MAIN wins on reconciliation by `(conversationId, turnIndex)`.
- Storage: IndexedDB via `idb` (`events`, `rollups`, `recommendations`, `meta`); `chrome.storage.local` for settings and adapter health. Daily alarm recomputes rollups and prunes per retention setting. On dataset upgrade, re-estimate stored events (tokens are stored) and show a one-time "numbers changed" notice.
- Composer hint: `@betteruseofai/ui-hint` mounted with `createShadowRootUi`; triggers on `input` debounced 400 ms, min 12 chars; renders at confidence ≥ 0.6; per-rule 24 h cooldown on dismiss; never blocks send or switches models.
- Resilience: adapter `version` + health states `ok | degraded | unsupported`; the popup says "adapter needs an update" instead of showing wrong numbers. Build-time flags only, no remote fetch. A `BUOA_DOM_ONLY=1` build exists in case a store rejects interception.
- Permissions: `storage`, `unlimitedStorage`, `alarms`; host permissions for the three sites only; `optional_host_permissions` for localhost, requested when the user enables local-UI detection. No `tabs`, `webRequest`, `scripting`, `<all_urls>`.
- Local UIs: Ollama-compatible `/api/chat` responses give exact `eval_count`/`prompt_eval_count`; LM Studio and Open WebUI via OpenAI-style endpoints; params inferred from model tag (e.g. `llama3.1:8b`) → parametric rows with `hosting: local` and the user's region.
- Firefox: `gecko.id`, `strict_min_version: "128.0"`, `data_collection_permissions: { required: ["none"] }`, `storage.local` only, `web-ext lint` in CI.
- UI uses `@betteruseofai/tokens` and re-implements `Readout`, `RangeBar`, `Tape`, `MetaStrip` with identical CSS classes so popup and site read as one system. Popup 360 px wide: three stacked readouts, one range bar, meta strip footer. Big Shoulders not loaded in the extension (weight); Plex Mono 500 for the headline figure.

## 7. CLIs and Claude Code plugin

### 7.1 Commands (identical in TS and Python; spec in `fixtures/cli/spec.md`)

`summary [--since --until --by day|week|model|surface|session --region --format table|json --source --dir]`, `sessions`, `session <id>` (the post-hoc report), `watch`, `export --format csv|json`, `models`, `statusline` (stdin JSON → one line), `hook <event>` (stdin JSON → hook JSON), `doctor`. Global `--json`, `--no-color`, `--now ISO` for deterministic fixtures; env overrides `BUOA_CLAUDE_DIR`, `CODEX_HOME`, `GEMINI_DATA_DIR`.

### 7.2 Readers (`packages/readers/src/`, mirrored in `apps/cli-py/src/betteruseofai/readers/`)

- `claude-code.ts`: glob `~/.claude/projects/*/*.jsonl`; assistant lines only; skip `<synthetic>` and API-error rows; dedupe `${message.id}:${requestId}` keeping the last; thinking = `thinking_tokens ?? null`; `regionHint = inference_geo`.
- `codex.ts`: glob `sessions/**` and `archived_sessions/**`; state machine over `session_meta`, `turn_context`, `token_count`; prefer `last_token_usage` delta, else diff cumulative; input = input − cached; output = output − reasoning; thinking = reasoning.
- `gemini-cli.ts` (P2): replay `$set`/`$rewindTo`; per `gemini` message tokens.

### 7.3 Parity contract

JSON output is the contract: sorted keys, UTF-8, `\n`, numbers to 6 significant digits via a shared decimal-string rounding rule, ISO-8601 UTC. Payload header `{ schemaVersion, datasetVersion, generatedWith }`; `generatedWith` is stripped before diffing. `fixtures/run-parity.mjs` points `HOME`/`USERPROFILE`/`CODEX_HOME` at `fixtures/logs/` and runs both implementations; `fixtures/diff.mjs` fails on any byte difference. CI matrix: ubuntu/macos/windows × Node 20/22 × Python 3.10/3.13. Python version is written from the npm version by `scripts/sync-py-version.mjs`.

### 7.4 Claude Code plugin (`apps/claude-code-plugin/`)

`.claude-plugin/plugin.json`, `hooks/hooks.json`, `bin/buoa` + `buoa.cmd` shims, `scripts/ensure-runtime.sh|.ps1` (SessionStart, async: Node ≥ 20 → bundled `dist/betteruseofai.mjs`; else `uv tool install`; else warning file), `scripts/statusline.sh|.ps1`, `commands/setup.md | report.md | footprint.md | mute.md`, `skills/betteruseofai-methodology/SKILL.md`.

- `UserPromptSubmit` → recommender with Claude-Code-specific thresholds (downgrade only for ordinal-0 models on short non-code prompts; never `no-llm` inside a coding session) → `systemMessage` one-liner; exit 0 always.
- `Stop` → incremental transcript parse from cached offset into `${CLAUDE_PLUGIN_DATA}/state/<session_id>.json`; every 10 stops or on threshold, a one-line `systemMessage` "Session so far: ~4.1 Wh (2–9), ~3 mL, ~1.5 gCO2e · 62% Opus".
- `PostModelSwitch` → cache current model.
- Statusline prints e.g. `~3.8 Wh (2–8) · ~3 mL · ~1.4 g · Opus 62% · ctx 41%` (ASCII option); target under 40 ms warm; `--cheap` mode reads only the Stop hook's cached totals if Node start-up is too slow on Windows.
- `/betteruseofai:setup` writes `statusLine` into `~/.claude/settings.json` after confirmation, pointing at a stable shim under `${CLAUDE_PLUGIN_DATA}` that ensure-runtime keeps updated (settings.json does not expand `${CLAUDE_PLUGIN_ROOT}`).

## 8. Website and design system (`apps/site/`, `packages/tokens/`)

### 8.1 Tokens (`packages/tokens/tokens.css`), all contrast ratios computed against `#eeece9`

| Token | Light | Ratio | Dark (on `#121412`) | Use |
|---|---|---|---|---|
| `--bg` / `--bg-raised` / `--bg-sunken` | `#eeece9` / `#f6f5f2` / `#e4e1dc` | | `#121412` / `#1a1d1a` / `#0c0e0c` | ground, cards, troughs |
| `--ink` / `--ink-2` | `#14201a` / `#1b2a21` | 14.2 / 12.7 | `#e6e3dc` / `#d9d6cf` | headlines, body |
| `--muted` | `#5b665f` | 5.07 | `#9aa39d` | labels, metadata |
| `--accent` / `--accent-strong` | `#0f6b3a` / `#0a5c31` | 5.59 / 6.88 | `#3ddc84` / `#6fe3a0` | links, buttons, central mark, focus |
| `--accent-tint` | `#d3e3d8` | fill only | `#183824` | selected rows, low band |
| `--hazard` | `#9a4b00` | 5.27 | `#f5a524` | high band, caveats, warning stripe |
| `--danger` | `#a3251c` | 6.27 | `#ff6b61` | errors |
| `--hairline` / `--border-ui` | `#cfcbc4` / `#6b756f` | decor / 4.05 | `#2a2f2b` / `#8f9892` | grid rules, input borders |

Rules: `--radius: 0`; no gradients except the 1 px hazard stripe; no band encoded by colour alone; theme via `data-theme` on `<html>`, default `prefers-color-scheme`, persisted in `localStorage` (disclosed).

### 8.2 Type (all SIL OFL, self-hosted via Astro Fonts API + Fontsource, latin subset, under 130 kB total)

- Display: **Big Shoulders** (700, 800) — condensed civic-signage feel, the open relative of Druk.
- Body: **Schibsted Grotesk** (400, 500, 700, 400 italic) — cold newspaper grotesk, avoids Inter-sameness.
- Mono: **IBM Plex Mono** (400, 500) — every number, label, unit, metadata; `tabular-nums slashed-zero`.
- Fluid scale `--step--2` (12 px mono labels) through `--step-5` (clamp 3.5–8.5 rem statement headlines, line-height 0.9).

### 8.3 Signature components (`apps/site/src/components/`)

`Readout` (big mono figure + unit + `[ low – high ]` + band label), `RangeBar` (three-stop bar, central tick in accent, high in hazard hatch), `MetaStrip` (`DATASET 2026-08-14 · v0.3.1 · UTC 09:41:12 · TELEMETRY: NONE · MIT`), `Hairline` (with `+` crosshairs at column intersections), `Index` (`01 / 07` section numbering), `Redacted` (ink block, reveals on hover/focus/tap, keyboard operable), `Hazard` (caveat block, max one per page), `SourceChip` (`[3]` opens a `<details>` with title, publisher, date, link), `Ticker`, `Tape` (`ESTIMATE · NOT A MEASUREMENT`), `Faq` ("Questions worth asking"), `StandBy` (no-JS fallback and 404), `ReviewGate` (draft banner), `Nav`, `Footer`, `ThemeToggle`, `PostCard`, `AuthorCard`. `/design` renders all of them in both themes (draft-gated, excluded from sitemap).

Motion: 120/200/320 ms, opacity and ≤ 8 px transforms, digit count-up, no parallax or scroll-jacking, full `prefers-reduced-motion` support. Visible 12-column hairline grid (`.grid-paper`) on landing, methodology and calculator. Buttons are mono uppercase verbs with objects ("Run the numbers", "Install the extension"); never "Get started" or "Learn more".

### 8.4 Astro stack and tree

Astro 5 static, `@astrojs/mdx`, `sitemap`, `rss`, `preact`; **vanilla CSS with tokens, no Tailwind**; Preact + signals for the calculator island; the landing readout is a vanilla TS script importing only `estimate()`; `markdown.syntaxHighlight: false` (plain mono code blocks, keeps the hashed CSP intact); `security.csp` in `astro.config.mjs` with `scriptDirective.resources: ['self', 'https://static.cloudflareinsights.com']`; no `<ClientRouter />`.

```
apps/site/src/
├─ content.config.ts            blog, authors, pages (all with status: draft|review|published), models + sources (from dataset), contributors, releases
├─ content/{blog,authors,pages}/
├─ loaders/{github-contributors,github-releases,core-models}.ts   build-time; 8 s timeout; fall back to public/fallback/*.json
├─ components/ ... islands/{Calculator.tsx, calc/*, LandingReadout.ts}
├─ layouts/{Base,Page,Post}.astro
├─ pages/ index, methodology, calculator, install, about, local-llms, privacy, changelog, design, 404,
│         blog/{index,[slug],tags/[tag],authors/[author]}, rss.xml.ts, atom.xml.ts, og/[...slug].png.ts, methodology/data.json.ts
└─ styles/{global,grid,components}.css
apps/site/public/{_headers,_redirects,fallback/contributors.json,fallback/releases.json}
apps/site/tests/{a11y,screenshots,calculator,csp}.spec.ts
```

### 8.5 Pages (wireframes in brief)

- **Landing**: no hero image. Statement "YOUR PROMPTS HAVE A WATER BILL." with an inline sentence containing three controls ("I send about [20] prompts a day to [a frontier model] from [world average]") driving three live readouts. Then: what this is; the three tools as a hairline table (with a `Redacted` "what we never see" cell); proof-point numbers with range bars; one screenshot of the recommender; cloud vs local with a `Hazard`; `Faq`; a self-aware page-weight ticker.
- **Methodology**: sticky `Index` TOC 01–08: scope, energy per token table from the dataset, water, carbon, token estimation, local inference model, limitations, dataset changelog + `/methodology/data.json` download. Every number has a `SourceChip`.
- **Calculator**: provider → model → mode; prompts/day or tokens/day with reply-length presets; region grouped by continent; period toggle; "compare with local" (device class, model size, local region). Results: three readouts with range bars, "where the range comes from" details, sourced equivalents, cloud-vs-local columns with a worded difference and `Hazard` if local is worse, recommender strip. State serialised to the URL **hash** (never the query string, so nothing reaches server logs); "Copy as text" produces a 72-column plain-text block with sources and dataset version.
- **Install**: hairline table of five routes (Chrome, Firefox, `npx`, `uvx`, Claude Code plugin) with copyable commands, SHA-256 verification, a "what it never does" permissions table, `Faq`.
- **About**: "WE BUILT THIS BECAUSE THE METER WAS MISSING." Why (user's own words first), `AuthorCard` for Anirudh Sharma with affiliation as `Redacted` TODO until filled, contributors grid from the build-time loader with a "snapshot from {date}" line when the fallback was used, how to contribute, licence, funding statement (none).
- **Blog**: hairline list, tag pages, author pages, RSS and Atom, OG images via satori at build. Seed drafts: "How we estimate water per prompt", "Why the frontier model is usually the wrong default", "Running a local model instead".
- **Local LLMs**: why and why not (`Hazard`), hardware tiers table, tools table (Ollama, LM Studio, llama.cpp, Jan), model picks per tier, link into the calculator with a preset.
- **Privacy**: everything stays local; fonts self-hosted; the one Cloudflare beacon with its exact script URL and what Cloudflare receives; `localStorage` theme; no cookies or forms.
- **Changelog** from GitHub releases (build time, fallback snapshot). **404** as a `StandBy` block.

### 8.6 Copy style guide and lint

`docs/STYLE.md`: British English, "we", present tense, sentences under 20 words on average, contractions normal, concrete sourced numbers over adjectives, say what we don't know. Banned words: delve, leverage, seamless, robust, empower, unlock, harness, elevate, supercharge, game-changing, cutting-edge, revolutionise, journey, landscape, navigate (figurative), tapestry, testament, crucial, vital, "in today's world", "it's worth noting". Banned constructions: rhetorical questions in body copy, "not X but Y" / "it's not X, it's Y", lists of exactly three, em and en dashes, exclamation marks, emoji, generic CTAs, sentences starting "Imagine".

Enforced by **Vale** (`styles/BUAI/`: Banned, Dashes, Exclaim, NotButRather, Rhetorical, Triplets as warning, Emoji, GenericCTA, en_GB spelling with project vocab) plus `scripts/copy-lint.ts` (every number near a `SourceChip`, no `TODO` in published pages, `status` present). CI fails on errors.

Draft gate: `status` front-matter on every entry, default `draft`. `visible()` helper filters blog posts to `published` on the `main` branch (`CF_PAGES_BRANCH`); previews show drafts. Structural pages render but with a hazard-striped `ReviewGate` banner and `noindex`. `REQUIRE_PUBLISHED=1` flips on at launch.

### 8.7 Cloudflare Pages

Build from repo root: `pnpm install --frozen-lockfile && pnpm --filter @betteruseofai/core build && pnpm --filter @betteruseofai/site build`, output `apps/site/dist`, `.node-version` 22, `PNPM_VERSION=10`. Env: optional read-only `GITHUB_TOKEN`, `PUBLIC_CF_BEACON_TOKEN`. Switch off Rocket Loader, Email Obfuscation, Auto Minify, Mirage, Bot Fight Mode JS challenge, and Web Analytics auto-injection (manual snippet). `public/_headers`: strict CSP (`default-src 'none'`, self + `static.cloudflareinsights.com` for scripts, `connect-src 'self'` because the beacon posts to `/cdn-cgi/rum`), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, immutable cache on `/_astro/*`, `noindex` on `*.pages.dev`. `_redirects`: `/github`, `/feed`, `/method`, `/install/chrome`, `/install/firefox`. Domain: add zone in Cloudflare, set the two nameservers at Namecheap (Domain List → Manage → Custom DNS), add `betteruseofai.org` and `www` as custom domains, Full (strict) TLS, Always HTTPS, DNSSEC, HSTS after a stable week. Preview deployments for every branch and PR.

### 8.8 Accessibility and performance

WCAG 2.2 AA (pairs above verified); 2 px accent focus ring; skip link; native `<details>` for FAQ and source popovers; `Redacted` reveals on focus and tap; 24 px targets. Lighthouse mobile targets: Performance ≥ 98, Accessibility/Best Practices/SEO 100. Budgets: landing ≤ 250 kB transfer, landing JS ≤ 25 kB gz, calculator JS ≤ 70 kB gz including core, fonts ≤ 130 kB, LCP ≤ 1.5 s, CLS 0, zero third-party requests except the beacon. Everything except calculator interactivity works without JS.

## 9. Testing and CI

| Layer | Tool | Fixtures |
|---|---|---|
| core, dataset, tokenizers, recommender | Vitest (+ ajv) | `fixtures/estimates/`, `fixtures/tokens/`, `fixtures/recommender/cases.jsonl` |
| readers, CLI parity | Vitest + pytest, `fixtures/run-parity.mjs`, `fixtures/diff.mjs` | `fixtures/logs/{claude-code,codex,gemini-cli}/` (synthetic, anonymised, covering duplicate ids, `<synthetic>` rows, null thinking, cumulative-only Codex), `fixtures/cli/cases.json` + `expected/` |
| extension unit | Vitest + `wxt/testing` fake-browser + fake-indexeddb | `fixtures/web/<site>/sse/*.txt` recorded SSE bodies |
| extension e2e | Playwright Chromium with `--load-extension`, host-resolver rules mapping the three hosts to a local static server serving sanitised page shells, `page.route` replaying recorded exchanges | `fixtures/web/<site>/page.html`; asserts capture, token estimate, hint appearance, dashboard totals, DOM fallback |
| Firefox | `web-ext lint` in CI; manual smoke checklist (Playwright cannot load Firefox extensions) | |
| plugin | bats-core + Vitest; stdin JSON fixtures; timing budget < 100 ms warm | |
| site | Vale, `copy-lint`, `astro check`, Playwright screenshots at 1440 and 390 in both themes, `@axe-core/playwright`, CSP violation spec, calculator hash round-trip and no-JS spec, Lighthouse CI budgets, `linkinator` | |

CI never touches live sites or provider APIs. Workflows: `ci.yml` (lint/typecheck/unit, 3 OSes), `parity.yml`, `e2e.yml`, `site.yml`, `dataset-links.yml` (weekly), `snapshots.yml` (weekly GitHub snapshot refresh PR), `release.yml`.

## 10. Release and versioning

Changesets with a fixed group `[core, dataset, tokenizers, readers, betteruseofai npm]`; extension and plugin versioned independently but bumped by the same run; Python version synced from npm. npm publish with OIDC provenance; PyPI via trusted publishing; extension zips (`-chrome`, `-firefox`, `-firefox-sources`) attached to the GitHub Release with `SHA256SUMS`, then `wxt submit` behind a manual approval environment for the first releases; plugin `dist/betteruseofai.mjs` rebuilt and committed by the release PR.

## 11. Benchmark and log-format research appendix (verified 2026-09-10; re-check each row when adding it to the dataset)

### 11.1 Per-prompt / per-token sources → dataset rows

| Source | Numbers | Scope / boundary | Methodology tag | Quality |
|---|---|---|---|---|
| Google, "Measuring the environmental impact of AI inference", blog 21 Aug 2025 + arXiv:2508.15734 | Median Gemini Apps text prompt: **0.24 Wh, 0.03 gCO2e, 0.26 mL**. Narrow accelerator-only: 0.10 Wh / 0.02 g / 0.12 mL. Breakdown: TPU 0.14, host CPU+DRAM 0.06, idle 0.02, overhead 0.02 Wh. PUE 1.09, WUE 1.15 L/kWh, carbon **market-based** 94 gCO2e/kWh (location-based 345) | Fleet median prompt, datacenter boundary, on-site water only, excludes network and devices | provider-measured | 4 (first-party, not peer-reviewed) |
| Altman, "The Gentle Singularity", Jun 2025 | **0.34 Wh**, 0.000085 gal = **0.32 mL** per "average query" | No model, boundary or date given | provider-statement | 2 |
| Mistral LCA, 22 Jul 2025 (Carbone 4, ADEME; reviewed by Resilio, Hubblo) | Mistral Large 2, one 400-token Le Chat reply: **1.14 gCO2e, 45 mL, 0.16 mg Sb-eq**. Training 20.4 ktCO2e, 281,000 m³ | Full lifecycle incl. manufacturing and upstream electricity water | provider-measured, boundary lifecycle | 5 |
| Jegham et al., "How Hungry is AI?", arXiv:2505.09598 **v6** (24 Nov 2025) | Wh per query short/medium/long (100→300, 1k→1k, 10k→1.5k tokens): GPT-4o 0.423/1.215/2.875; GPT-4.1 nano 0.207/0.575/0.827; GPT-4.1 0.871/3.161/4.833; o3 1.177/5.153/12.222; o4-mini high 3.649/7.380/7.237; Claude 3.7 Sonnet 0.950/2.989/5.671; Claude 3.5 Sonnet 0.973/3.638/7.772; DeepSeek-R1 (Azure) 2.353/4.331/7.410; LLaMA 3.3 70B 0.237/0.760/1.447. Multipliers: Azure PUE 1.12, WUE 0.30 on-site + 4.35 off-site L/kWh, CIF 350 g/kWh; AWS PUE 1.14, WUE 0.18 + 5.11, CIF 287 g/kWh | Latency × rated DGX power × utilisation; closed-model sizes guessed; Google not covered | independent-benchmark, `per-query-set` | 3 (good for relative ranking, weak on absolutes) |
| Epoch AI, "How much energy does ChatGPT use?", 7 Feb 2025 | **~0.3 Wh** per GPT-4o query (500 output tokens); 10k input → ~2.5 Wh; 100k → ~40 Wh | Bottom-up GPU estimate, H100 at 1,500 W incl. overhead, 10% utilisation | independent-benchmark | 3 |
| Microsoft Research, Oviedo et al., *Joule* Apr 2026, arXiv:2509.20241; MS Cloud blog 15 Jun 2026 | Median **0.31 Wh/query (IQR 0.16–0.60)**; test-time scaling 15× longer output → **3.91 Wh (2.15–7.05)**; water **0.0–0.067 mL** on-site | Simulation, not fleet telemetry | independent-benchmark (vendor-authored) | 3 |
| Hugging Face AI Energy Score v2, 4 Dec 2025 | GPU Wh per 1,000 queries on H100, batch 1, FP16; reasoning mode ~30× average, 150–700× peak (e.g. R1-Distill-Llama-70B 49.5 → 7,627 Wh/1k) | Open models only, GPU-only, no idle or PUE | independent-benchmark | 4 for open/local models |
| EcoLogits (JOSS 2025) | energy/token = α·e^(βB)·P_active + γ, α=1.17e-6, β=−1.12e-2, γ=4.05e-5 kWh; 8-GPU server 1.2 kW base; PUE 1.09–1.20; WUE 0.09–0.99 | Parametric fallback for unmeasured models | parametric-model | 3 |
| Luccioni et al., "Power Hungry Processing", arXiv:2311.16863 (FAccT 2024) | Text generation 0.047 kWh per 1,000 inferences (A100); image generation 2.907 | Small 2023 models | independent-benchmark | 2 for 2026 models |
| Li et al., "Making AI Less Thirsty", arXiv:2304.03271 v5 (CACM 2025) | Off-site water US 3.1 L/kWh consumption, 43.8 withdrawal; on-site WUE 0.55 (Microsoft US), 1.0 (Google), 9.0 (Arizona summer); 500 mL per 10–50 GPT-3 replies | Scope framework for water | reference | 4 for factors |
| Anthropic, OpenAI (beyond Altman), Perplexity, xAI | **No first-party per-query disclosure** as of mid-2026 | Use proxy rows, flag `proxy-row` | proxy | — |

Reasoning overhead: o3 vs GPT-4o 2.8–4.3× (Jegham); Dauner and Socher 2025: reasoning models average 543.5 thinking tokens per question vs 37.7; energy scales roughly linearly with output tokens, so thinking tokens are charged as output.

### 11.2 Regions and water intensity

- **Ember Yearly Electricity Data** (CC BY 4.0, 200+ geographies, gCO2e/kWh): vendor as `regions.json`. Our World in Data mirrors it.
- **Electricity Maps** is ODbL (share-alike) and must **not** be vendored into an MIT repo.
- **EPA eGRID2023** (public domain): US total 770.884 lb CO2e/MWh ≈ 349.7 gCO2e/kWh, subregions in xlsx. **CEA India v21.0** (Dec 2025): 0.710 tCO2/MWh weighted average. IEA factors are paid; do not vendor.
- Off-site water by region: **WRI, "Guidance for Calculating Water Use Embedded in Purchased Electricity"** (2020, CC BY 4.0) appendix dataset; Macknick et al. 2012 (NREL) for technology-level factors.

### 11.3 Equivalence factors

Glass 237 mL (US cup convention); LED bulb 8–10 W (≈ 9 Wh per bulb-hour, LEDVANCE); smartphone charge 0.019 kWh and 12.4 gCO2 (EPA equivalencies calculator, updated Aug 2026); petrol car EPA 393 gCO2e/mile ≈ 244 g/km, UK DEFRA 2025/26 "Average car, petrol" cell to be copied from the gov.uk xlsx; Google search 0.0003 kWh and 0.2 gCO2 (2009, 17 years old, flag prominently).

### 11.4 Local inference energy

Apple M4 Pro (GreenBench, arXiv:2608.28667, Q4_K_M, Ollama): Llama 3.2 3B 0.09 J/token, Phi-3 3.8B 0.12, Qwen 2.5 7B 0.20, Mistral 7B 0.22, Gemma 2 9B 0.25 at ~10 W system. RTX 4090, Llama 3.1 8B, vLLM: ≈ 0.29 J/token at 280–410 W (GIGAGPU 2026, verify; page returned 403). Dual RTX 3090, 13B 5-bit: 12.1–19.2 J/token (Mattheij 2024). Throughput-only references for RTX 3060 (42 tok/s), 4070 (52), 4090 (104) on 8B Q4. Preferred method where the UI exposes it: `eval_duration × measured board power`. `zeus-apple-silicon` and `powermetrics` for Macs, `nvidia-smi` for NVIDIA.

### 11.5 Log formats and endpoints (supplements §3)

- **Codex**: `cached_input_tokens` is a subset of `input_tokens`; GPT-5.6 cache-write tokens currently dropped (openai/codex#32479); subagent replays inherit the parent snapshot, so take per-turn deltas, never sum cumulative totals.
- **Gemini CLI**: model recorded per message; `GEMINI_DATA_DIR` default `~/.gemini/tmp`; format still evolving. Telemetry alternative: `gemini_cli.api_response` events with `input_token_count`, `output_token_count`, `cached_content_token_count`, `thoughts_token_count`, `tool_token_count`.
- **Cursor (P3)**: `globalStorage/state.vscdb` SQLite, `cursorDiskKV` keys `composerData:*` and `bubbleId:*` carry `inputTokens`/`outputTokens` unevenly; `~/.cursor/chats/*/store.db` has `lastUsedModel`. The Admin API (`POST /teams/filtered-usage-events`) is team-admin only. Present Cursor as best-effort with a visible coverage percentage.
- **Copilot Chat (P3)**: `workspaceStorage/<hash>/chatSessions/*.json|jsonl`, `globalStorage/emptyWindowChatSessions/`, `globalStorage/github.copilot-chat/transcripts/`; `requests[].modelId` present, **no token counts** → estimate from text. Coding-agent sessions live only in `state.vscdb`.
- **claude.ai**: `GET .../chat_conversations/{id}?tree=True` returns only the current model; per-message model history is lost, so capture at send time.
- **Perplexity (P2)**: `POST /rest/sse/perplexity_ask` with `model_preference`; no documented "model that answered" field. **Le Chat (P2)**: no documented endpoint; DOM-based like carbon-llm.
- **Local UIs**: Ollama `:11434` `/api/chat` final chunk → `prompt_eval_count`, `eval_count`, `eval_duration` (exact); LM Studio `:1234` `/api/v0/chat/completions` → `usage` + `stats.tokens_per_second`; Open WebUI container `:8080`, host `:3000`, `/api/chat/completions` → OpenAI `usage`; Jan `:1337` `/v1/chat/completions` → `usage`.

### 11.6 Prior art to credit in README and methodology

GreenChat (simonbiennier, MIT), AI Impact Tracker (simonaszilinskas, GPL-3.0, EcoLogits method), AI Wattch (MIT, DOM parsing for ChatGPT/Claude/Gemini, "One Token Model"), argmin extension, carbon-llm (Web Store), GPTFootprint (CHI EA '25, arXiv:2505.24107), claude-carbon (gwittebolle, MIT, Claude Code sessions), EcoLogits, Andy Masley's prompt-footprint calculator, ccusage, codex-trace, tokscale, rajbos/github-copilot-token-usage. Note GPL-3.0 code cannot be copied into this MIT repo; learn from it, credit it, do not paste it.

## 12. Implementation sequence

0. **Toolchain and accounts**: install pnpm (via corepack), uv, Vale; user creates the GitHub org, Cloudflare account, store accounts. `git init`, MIT licence, `.editorconfig`, `.gitattributes` (LF), root README, `CONTRIBUTING.md` with the attribution rule (no AI model named as author or co-author in commits, PRs, site or metadata) and a `commit-msg` hook (via `simple-git-hooks`) that rejects `Co-Authored-By` trailers naming an AI model or any "Generated with" footer.
1. **Scaffold**: pnpm workspaces, Turborepo, changesets, tsconfig, CI skeleton, `.claude-plugin/marketplace.json`.
2. **`packages/dataset`**: schemas, first verified rows (§5.4, §11), regions from Ember, equivalents, calibration, build script, changelog.
3. **`packages/core`**: types, normalise, estimate, aggregate, equivalents, format; unit tests and `fixtures/estimates`.
4. **`packages/tokens`** and the `/design` sheet: tokens, fonts, component CSS in both themes, contrast test script. Screenshot and adjust before any page is built.
5. **`packages/readers`** (Claude Code, Codex) + `fixtures/logs` → **`apps/cli-ts`** → **`apps/cli-py`** mirror → parity CI green.
6. **Recommender** + fixtures, TS then Python.
7. **`apps/claude-code-plugin`** against the CLI build; test the setup command on this machine.
8. **`packages/tokenizers`** → **`apps/extension`**: background, storage, bridge, claude.ai adapter first, then chatgpt.com (use `resolved_model_slug`), then gemini (model from the `x-goog-ext-525001261-jspb` header, DOM picker as fallback); popup → hint → options → dashboard → local-UI adapters → Playwright e2e.
9. **`apps/site`**: scaffold, layouts, nav, footer, meta strip, theme toggle, content config with draft gate; landing readout; methodology from dataset; calculator island; install, about (loaders + fallbacks), local LLMs, privacy, changelog, 404; blog with seed drafts and OG images; Vale + copy-lint + Playwright + axe + CSP + Lighthouse.
10. **Copy pass** once voice samples arrive; user reviews every page; flip `REQUIRE_PUBLISHED=1`.
11. **Deploy**: Cloudflare Pages project, env vars, zone switches, Namecheap nameservers, Web Analytics manual snippet, HSTS later. Release automation, store submissions, docs.

## 13. Verification (end to end)

- `pnpm turbo test` green on all packages; `node fixtures/run-parity.mjs && node fixtures/diff.mjs` shows zero differences between TS and Python.
- `npx betteruseofai summary --since 7d` on this machine reports real Claude Code sessions from `~/.claude/projects` with ranges and no zero-for-unknown.
- Claude Code plugin installed locally: statusline shows the live footprint; a "rewrite this sentence" prompt on Opus produces a `systemMessage` nudge; `/betteruseofai:report` prints the session report.
- Extension loaded unpacked in Chrome and Firefox: send a message on claude.ai, chatgpt.com and gemini.google.com, confirm the popup shows a new estimate with the right model, the composer hint appears for "summarise this" and not for a long code prompt, the dashboard shows day/week/all-time and cloud-vs-local, and the network panel shows zero outbound requests from the extension.
- Site: `pnpm --filter site build` passes Vale, copy-lint, `astro check`; Playwright screenshots at 1440 and 390 in both themes reviewed by eye; axe clean; CSP spec clean; Lighthouse budgets met; calculator hash round-trip and copy-as-text verified; preview URL on `*.pages.dev` is `noindex`; production on `betteruseofai.org` loads only self-hosted assets plus the one disclosed beacon.

## 14. Risks, ordered

1. Web apps change endpoints or DOM (certain, recurring) → adapter versioning, health states, DOM fallback, recorded fixtures, "unsupported" instead of wrong numbers, HAR-sanitising script for contributors.
2. Benchmarks disagree by an order of magnitude → ranges everywhere, methodology and boundary visible, citations on every number, dataset changelog.
3. Hidden reasoning tokens unknown on web apps → explicit flag, "≥" rendering, calibrate ratios offline from CLI logs that do expose them.
4. Plugin cannot set `statusLine`; settings paths don't expand plugin variables → setup command writes a stable shim path.
5. Node or uv absent for plugin scripts → runtime fallback chain, `--cheap` statusline mode.
6. TS/Python numeric drift → canonical JSON, shared rounding, 3-OS parity matrix, UTC-only with `--now` injection.
7. Store review of MAIN-world interception → minimal permissions, readable interceptor, DOM-only build flag.
8. Copy sounding generated → voice samples, Vale rules, user review gate on every page.
9. Token estimation error for Anthropic/Google → calibration ranges compounded into output, "~" marker, periodic recalibration.
10. Recommender annoyance → conservative thresholds, vetoes, cooldowns, one-click mute, off-by-default hint in Claude Code.
