<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/tokens/logo/png/lockup-horizontal-paper.png">
  <img src="packages/tokens/logo/png/lockup-horizontal-ink.png" alt="Better Use of AI" width="252" height="32">
</picture>

# Better Use of AI

Every prompt you send to a large language model draws electricity and water somewhere. Almost nobody
using ChatGPT, Claude, Gemini or a coding agent can see how much. The default model is usually the
most expensive one on offer, and most of the time it's overkill.

This project puts a meter on it. We show the energy, water and carbon behind your own usage, with
honest uncertainty ranges and a source behind every number, and we nudge you towards a smaller model,
a local model, or no model at all when the frontier model isn't earning its keep.

## What's in here

| Piece | What it does |
|---|---|
| Browser extension | Counts what you send on claude.ai, chatgpt.com and gemini.google.com, plus local LLM front ends |
| Command line tools | Read your Claude Code and Codex CLI logs and report per session, per day, per model |
| Claude Code plugin | A live statusline figure and a nudge before you send a prompt a smaller model could handle |
| Website | The methodology, a calculator, and a guide to running models locally |

Everything ships from one dataset of published benchmarks, so the extension, the CLIs and the site
agree on the numbers.

## Privacy

Everything runs on your machine. There's no backend, no account, and no telemetry. Your prompts are
never stored and never sent anywhere. The benchmark data ships inside the packages, so we don't fetch
anything at runtime either.

The website carries one third-party script, a cookieless Cloudflare Web Analytics beacon, and the
privacy page says exactly what it sends.

## Honest about the numbers

Published measurements of AI energy use disagree by an order of magnitude, mostly because they draw
the system boundary in different places. Google's figure counts on-site cooling water. Mistral's
life-cycle assessment counts manufacturing and upstream electricity too, and lands about 170 times
higher on water for a single reply.

So every figure we show is a range, tagged with the methodology and boundary it came from, and one
click from its source. Where we don't know something we say so. An unknown model shows as unknown,
never as zero. The whole method, step by step, is at
[betteruseofai.org/methodology](https://betteruseofai.org/methodology).

## Licence

MIT for the code. See [LICENSE](LICENSE). The three typefaces are under the SIL Open Font License;
[FONTS.md](FONTS.md) has the notice.

## Prior art

We read a lot of other people's work before writing any of this, and we owe these projects the credit:

- [EcoLogits](https://github.com/genai-impact/ecologits), the parametric energy model we fall back on
  for open models
- [AI Impact Tracker](https://github.com/simonaszilinskas/ai-impact-tracker) by Simonas Zilinskas
- [GreenChat](https://github.com/simonbiennier/greenchat) by Simon Biennier
- AI Wattch, and its "One Token Model" framing
- [carbon-llm](https://chromewebstore.google.com/) and the argmin extension
- [GPTFootprint](https://arxiv.org/abs/2505.24107), CHI EA '25
- [claude-carbon](https://github.com/gwittebolle/claude-carbon) by Guillaume Wittebolle
- [ccusage](https://github.com/ryoppippi/ccusage), codex-trace and tokscale, for how to read agent logs
- Andy Masley's prompt footprint calculator

AI Impact Tracker is GPL-3.0. We studied its approach and credit it here. We haven't copied any of its
code into this MIT repository, and we won't.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. It carries one rule that trips people up: no AI model is
ever named as an author or co-author of a commit or a pull request here. A commit hook enforces it.

Benchmark rows are the most useful thing to contribute. See `docs/dataset-contributing.md` for what a
row needs before we'll take it.
