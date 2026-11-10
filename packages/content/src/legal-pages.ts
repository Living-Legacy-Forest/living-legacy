// The legal pages editors change in the CMS. Fixed: there is no adding or
// deleting them, so the slugs are the whole list.
import { z } from 'zod';
import { type RichTextDoc, richTextSchema } from './posts';
import { richTextPlainText } from './rich-text-html';

export const legalSlugs = ['privacy', 'terms-and-conditions'] as const;
export type LegalSlug = (typeof legalSlugs)[number];
export const legalSlugSchema = z.enum(legalSlugs);

export const legalValuesSchema = z.object({
  title: z.string().trim().max(200),
  body: richTextSchema.nullable(),
  seoDescription: z.string().trim().max(300),
});
export type LegalValues = { title: string; body: RichTextDoc | null; seoDescription: string };

/** Why a version cannot go live yet; empty when it can. */
export function legalPublishErrors(values: LegalValues): string[] {
  const errors: string[] = [];
  if (!values.title.trim()) errors.push('Add a title before publishing.');
  if (!values.body || !richTextPlainText(values.body).trim()) {
    errors.push('Add the page text before publishing.');
  }
  return errors;
}

export const legalPath = (slug: LegalSlug) => `/${slug}/`;
