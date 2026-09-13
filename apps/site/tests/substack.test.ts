import { describe, expect, it } from 'vitest';

import { parseFeed } from '../src/loaders/substack';

/**
 * The feed parser, on a fixture in the shape Substack actually emits: CDATA
 * titles, an HTML description, a dc:creator, and one item with no link, which
 * must be dropped rather than rendered as a dead entry.
 */
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title><![CDATA[A Substack]]></title>
<item>
<title><![CDATA[Why the frontier model is usually the wrong default]]></title>
<description><![CDATA[<p>Most of what people ask a model does not need the largest one. The gap in cost is much larger than the gap in quality.</p><p>More below.</p>]]></description>
<link>https://example.substack.com/p/frontier-by-default</link>
<pubDate>Thu, 11 Sep 2026 08:00:00 GMT</pubDate>
<dc:creator><![CDATA[Anirudh Sharma]]></dc:creator>
</item>
<item>
<title><![CDATA[A post with no address]]></title>
<description><![CDATA[Nothing to link to.]]></description>
<pubDate>Wed, 10 Sep 2026 08:00:00 GMT</pubDate>
</item>
<item>
<title>Plain &amp; unquoted</title>
<description>One sentence. Then another that should not appear.</description>
<link>https://example.substack.com/p/plain</link>
<pubDate>Tue, 09 Sep 2026 08:00:00 GMT</pubDate>
</item>
</channel>
</rss>`;

const contributor = { name: 'Example', url: 'https://example.substack.com' };

describe('the substack feed parser', () => {
  const posts = parseFeed(FEED, contributor);

  it('keeps the items with a title and an address, and drops the one without', () => {
    expect(posts).toHaveLength(2);
    expect(posts.map((post) => post.title)).toEqual([
      'Why the frontier model is usually the wrong default',
      'Plain & unquoted',
    ]);
  });

  it('reads the date to the day and the summary to the first sentence, tags stripped', () => {
    expect(posts[0]).toMatchObject({
      contributor: 'Example',
      contributorUrl: 'https://example.substack.com',
      url: 'https://example.substack.com/p/frontier-by-default',
      date: '2026-09-11',
      summary: 'Most of what people ask a model does not need the largest one.',
    });
    expect(posts[1]?.summary).toBe('One sentence.');
  });

  it('never carries markup into the page', () => {
    for (const post of posts) {
      expect(post.title).not.toMatch(/<[^>]+>/);
      expect(post.summary).not.toMatch(/<[^>]+>/);
    }
  });
});
