import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Every entry carries a status, and the default is draft.
 *
 * Nothing reaches a reader as finished work until somebody has read it, which
 * is a person's decision and not a build flag. src/lib/status.ts holds what
 * each status does.
 */
const status = z.enum(['draft', 'review', 'published']).default('draft');

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    authors: z.array(z.string()).default(['anirudh']),
    tags: z.array(z.string()).default([]),
    status,
  }),
});

const authors = defineCollection({
  loader: glob({ base: './src/content/authors', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    links: z.record(z.string(), z.string()).default({}),
  }),
});

export const collections = { blog, authors };
