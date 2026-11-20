import { z } from 'zod';

// Shared by the server functions (which validate with them) and the server-only logic.

export const postFieldSchema = z.object({
  field: z.enum(['seoTitle', 'seoDescription', 'excerpt', 'focusKeyword', 'tags']),
  title: z.string().max(300),
  excerpt: z.string().max(500),
  bodyMarkdown: z.string().max(200_000),
  /** The tags that already exist; a suggestion for tags may only use these. */
  tagNames: z.array(z.string().max(60)).max(500),
});
export type PostFieldInput = z.infer<typeof postFieldSchema>;

export const altTextSchema = z.object({ mediaId: z.string() });

export const brandFixSchema = z.object({
  text: z.string().max(2000),
  found: z.string().max(100),
  limit: z.number().int().min(1).max(2000),
});
export type BrandFixInput = z.infer<typeof brandFixSchema>;
