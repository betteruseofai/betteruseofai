# Copy style

> Status: draft. This page describes the rules. The voice itself is still waiting on writing samples
> from Anirudh, and every page stays `status: draft` until those arrive and each page is reviewed.

## Voice

British English. First person plural, "we". Present tense. Contractions are normal, not a concession.
Sentences average under twenty words. Concrete sourced numbers instead of adjectives. Where we don't
know something, we say we don't know.

The register we're after is closer to a well-made instrument panel than to a product launch. Slightly
cold, a bit dystopian, never breathless. Reference points: brikken.co, daoism.systems.

## Banned words

delve, leverage, seamless, robust, empower, unlock, harness, elevate, supercharge, game-changing,
cutting-edge, revolutionise, journey, landscape, navigate (in the figurative sense), tapestry,
testament, crucial, vital, "in today's world", "it's worth noting".

## Banned constructions

- Rhetorical questions in body copy.
- "Not X but Y" and "it's not X, it's Y".
- Lists of exactly three items. Use two, or four, or more.
- Em dashes and en dashes. Use a comma, a full stop, or brackets.
- Exclamation marks.
- Emoji, anywhere, including commit messages.
- Generic calls to action. "Get started" and "Learn more" are out. Buttons are uppercase mono verbs
  with an object: "Run the numbers", "Install the extension", "Read the method".
- Sentences that open with "Imagine".

## Numbers

Every number in published copy sits next to a source chip or a link to one. Ranges are written
`low to high` in prose and `[ low - high ]` in a readout. Estimated token counts carry a tilde. A
figure with hidden reasoning tokens carries a "greater than or equal to" marker and says why.

Absence never renders as zero. Unknown model reads "unknown".

## Enforcement

Vale, pinned to v3.21.0, with the rule set in `styles/BUAI/`. Rules: Banned, Dashes, Exclaim,
NotButRather, Rhetorical, Triplets (warning only), Emoji, GenericCTA, plus en_GB spelling with a
project vocabulary. Alongside it, `scripts/copy-lint.ts` checks that every number is near a source,
that no published page contains a TODO, and that every entry has a `status` field.

The Vale rule set lands with the website. Until then, copy is checked against this page by eye.
