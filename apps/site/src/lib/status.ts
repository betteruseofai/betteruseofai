/**
 * The draft gate.
 *
 * Every page and post carries a status. Nothing reaches a reader as finished
 * work until somebody has read it, so the default is `draft` and the build has
 * to be told otherwise.
 *
 * Two switches, deliberately separate:
 *
 *   isProduction   true on the branch that serves betteruseofai.org. Preview
 *                  deployments show drafts, because that is what they are for.
 *   requirePublished  set at launch. Until then a draft page still renders,
 *                  with a banner on it and noindex in the head.
 */

export type Status = 'draft' | 'review' | 'published';

const env = import.meta.env as Record<string, string | undefined>;

/** Cloudflare Pages sets this on every build. */
export const branch = env.CF_PAGES_BRANCH ?? env.BRANCH ?? 'local';

export const isProduction = branch === 'main';

/** Flips on at launch, when the copy has all been read. */
export const requirePublished = env.REQUIRE_PUBLISHED === '1';

/** A page that is not published gets a banner and is kept out of search. */
export const isUnreviewed = (status: Status): boolean => status !== 'published';

/**
 * Whether a blog post appears in a listing.
 *
 * Structural pages always render, because a site with a missing methodology
 * page is worse than one with a draft banner on it. Posts are different: an
 * unfinished post is just absent.
 */
export const postIsVisible = (status: Status): boolean =>
  status === 'published' || !isProduction;

/** What the robots meta should say. */
export const robotsFor = (status: Status): string =>
  isUnreviewed(status) || !isProduction ? 'noindex, nofollow' : 'index, follow';
