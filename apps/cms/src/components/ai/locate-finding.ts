import { type PostInput, type RichTextDoc, outlineRichText, sentenceAround } from '@ll/content';

export type LocatedField = 'title' | 'excerpt' | 'seoTitle' | 'seoDescription' | 'body';

/**
 * Which of a post's fields holds a brand problem, and the sentence it sits in. Searched in the
 * order a visitor meets them. A word only in an image description inside the body is not found
 * here (that is not text this can rewrite), so no fix is offered for it.
 */
export function locateFinding(
  values: Pick<PostInput, LocatedField>,
  found: string
): { field: LocatedField; sentence: string } | null {
  const searched: [LocatedField, string][] = [
    ['title', values.title],
    ['excerpt', values.excerpt],
    ['seoTitle', values.seoTitle],
    ['seoDescription', values.seoDescription],
    ['body', outlineRichText(values.body as RichTextDoc | null).text],
  ];
  for (const [field, text] of searched) {
    const sentence = sentenceAround(text, found);
    if (sentence) return { field, sentence };
  }
  return null;
}
