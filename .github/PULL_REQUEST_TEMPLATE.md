## What this changes

<!-- One paragraph. What a reader of the changelog needs to know. -->

## The two rules that trip people up

- [ ] No AI model or vendor is named as an author or co-author anywhere in this change: no
      `Co-Authored-By` trailer, no "Generated with" footer. Whatever tools you used, the commit is
      attributed to you. `CONTRIBUTING.md` has the rule; a hook enforces it.
- [ ] No number appears in copy without a source beside it, and nothing renders a missing value as
      nought.

## If this adds or changes a benchmark row

`docs/dataset-contributing.md` has the full list. The short form:

- [ ] A public source with a publisher, a date, and the date you read it
- [ ] A stated boundary: `accelerator-only`, `server`, `datacenter` or `lifecycle`
- [ ] A methodology tag
- [ ] A quality score from 1 to 5 you can defend, and a proxy row scores at most 2
- [ ] A range, with `notes` saying where its width came from
- [ ] `provenance` set, and a line in `packages/dataset/CHANGELOG.md`

## If this touches a page, the extension or the terminal

- [ ] `pnpm turbo run build typecheck test` is green
- [ ] For the site: `copy-lint` is clean and the screenshots at 1440 and 390 in both themes have
      been looked at
- [ ] For the two command line tools: `node fixtures/run-parity.mjs` shows every case the same
