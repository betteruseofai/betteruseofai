# Contributing a benchmark row

> Status: draft. This copy hasn't been through a voice review yet.

The dataset in `packages/dataset` is the part of this project that matters most. Everything else is
plumbing around it. This page is what a row needs before we'll take it.

## What a row needs

**A public source.** A URL anyone can open, with a publisher, a date, and the date you read it. A
number from a conversation, a screenshot, or a paywalled report we can't check is not a row.

**A stated boundary.** Pick one of `accelerator-only`, `server`, `datacenter`, `lifecycle`. This is the
single biggest reason published figures disagree. Google's 0.26 mL of water and Mistral's 45 mL are both
correct; they're counting different things. If the source doesn't say what it counted, say so in `notes`
and score it low.

**A methodology tag.** `provider-measured` when the operator measured its own fleet.
`provider-statement` when someone at the company said a number without showing their working.
`independent-benchmark` for outside measurement or bottom-up estimation. `parametric-model` for a formula.
`proxy` when we're scaling one model's row to cover another.

**A quality score from 1 to 5.** Be hard on yourself. A blog sentence with no model and no boundary is a
2 at best. A reviewed life-cycle assessment is a 5. Proxy rows are capped at 2 by a test, because a guess
is not a measurement no matter how carefully it was made.

**A range, not a point.** Every number is `{ low, central, high }`. If the source gives a single figure,
the range is your job: state in `notes` where the width came from. A narrow range you can't defend is
worse than a wide one you can.

**Provenance.** `source-appendix` if you transcribed it from the research appendix in `PLAN.md`.
`fetched` if you opened the source and read the number yourself during the change. `recalled-pending-refetch`
if you wrote it from memory. That last one is allowed, and it's honest, and the build prints a count of
how many rows are in that state so it can't quietly grow.

## Shapes

| Shape | When | Payload |
|---|---|---|
| `per-prompt` | One published figure for one exchange | Energy, or water and carbon directly, plus reference token counts |
| `per-query-set` | Measurements at several prompt sizes | Two or more points, fitted to a line in input and output tokens |
| `per-token` | A published rate | Input and output rates |
| `parametric` | A formula from active parameters | EcoLogits coefficients |
| `proxy` | No measurement exists for this model | A parent row and a scaling factor |

A per-prompt row usually has to assume its token counts, because almost nobody publishes them. Set
`tokenCountsPublished` to false when you assume, and the engine widens the result to match.

## What the build checks

`pnpm --filter @betteruseofai/dataset build` fails, rather than repairing anything, when:

- a range is out of order
- a benchmark row names a model that doesn't exist
- a proxy points at a missing row, at itself, or at another proxy
- two models claim the same alias
- a model that can think has no thinking ratio, which would let an undisclosed thinking count vanish
- a data file's version doesn't match the others
- an equivalent is measured in the wrong unit for its quantity

The tests in `test/dataset.test.ts` go further and check the rules that keep the numbers honest, including
that the Google row reproduces its own published water figure from its energy and its WUE.

## Versioning

A data-only change is a minor bump. A schema change is a major bump. The dataset version is the version of
the whole published group, so a user can tell which dataset a given CLI shipped with. Add a line to
`packages/dataset/CHANGELOG.md` with your change.

## Licences

We can vendor Ember (CC BY 4.0), EPA eGRID (public domain), CEA India, and WRI water factors (CC BY 4.0).
We cannot vendor Electricity Maps, whose data is share-alike licensed and would infect an MIT repository.
IEA factors are paid and are also out. If you're not sure, ask before you add the file.
