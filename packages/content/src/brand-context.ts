import { phraseRegex } from './rich-text-outline';

/**
 * The sentence holding the first whole-phrase, any-case match of `found`, or null. Sentences end at
 * a full stop, question mark, exclamation mark or new line; the end mark stays with its sentence.
 * Used to show (and rewrite) just the wording around a brand problem rather than a whole post.
 */
export function sentenceAround(text: string, found: string): string | null {
  const phrase = phraseRegex(found);
  for (const sentence of text.match(/[^.?!\n]+(?:[.?!]+|$)/g) ?? []) {
    phrase.lastIndex = 0;
    if (phrase.test(sentence)) return sentence.trim();
  }
  return null;
}
