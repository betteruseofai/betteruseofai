# Contributing

Thanks for looking. This is a small project with a strict brief, so it's worth reading this page before
you open a pull request. How we treat each other here is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md),
and how to report a security problem is in [SECURITY.md](SECURITY.md).

## The attribution rule

**No AI model is ever named as an author or co-author here.**

That covers commit messages, pull request descriptions, the website, the README, package metadata and
code comments. Concretely, none of these may appear:

- a `Co-Authored-By` trailer naming Claude, GPT, Gemini, Copilot, Anthropic, OpenAI or any other model
  or vendor
- a "Generated with" or "Co-authored by AI" footer
- a robot emoji in a commit message

A `commit-msg` hook rejects commits that break this. It runs automatically once you've run `pnpm install`.
If you're working outside the repo's hooks, check your message by hand before you push.

Use whatever tools you like to write the code. The rule is about who the commit is attributed to, and the
answer is you.

## Getting set up

You'll need Node 22 or newer, pnpm 10, and uv if you're touching the Python CLI.

```
pnpm install
pnpm turbo build
pnpm turbo test
```

## What we most want

Benchmark rows. The dataset in `packages/dataset` is the heart of this, and it's only as good as its
sources. `docs/dataset-contributing.md` sets out what a row needs: a public source with a date, a stated
system boundary, a methodology tag, and a quality score you can defend. We'd rather have a wide honest
range than a narrow guess.

Site adapters are the second most useful thing. Web apps change their endpoints often, and an adapter
that's gone stale reports wrong numbers, which is worse than reporting nothing.

## What we won't take

- Code copied from a GPL-licensed project. This repository is MIT. We credit prior art in the README and
  we learn from it, and that's as far as it goes.
- Anything that sends data off the user's machine. No analytics in the extension or the CLIs, no error
  reporting, no remote configuration, no fetching benchmark updates at runtime.
- A number without a source.
- Copy that reads as though a language model wrote it. `docs/STYLE.md` has the list, and Vale checks it
  in CI.

## Numbers, and the rule that matters most

Absence never renders as zero. If we don't know the model, we print "unknown". If a model hides its
reasoning token count, we print a lower bound with a "greater than or equal to" marker and a flag saying
why. Rounding a missing value down to nought makes the tool lie in the most flattering direction, which
is the one direction it must never lie in.
