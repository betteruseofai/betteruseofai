import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { postIsVisible, type Status } from '../lib/status';

/**
 * Only published posts go in the feed, on every branch.
 *
 * A draft is visible on the site during a preview build, because that is what
 * a preview is for. A feed is different: a reader's client keeps what it
 * fetched, so an unfinished post that appears once cannot be taken back.
 */
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog'))
    .filter((post) => post.data.status === 'published' && postIsVisible(post.data.status as Status))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'Better Use of AI',
    description: 'Notes on the energy, water and carbon behind language models.',
    site: context.site ?? 'https://betteruseofai.org',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}`,
    })),
  });
}
