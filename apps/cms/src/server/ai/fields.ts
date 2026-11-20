import {
  FOCUS_KEYWORD_LIMIT,
  RELATED_TERM_LIMIT,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
} from '@ll/content';
import type Anthropic from '@anthropic-ai/sdk';

/** The one model behind every suggestion. */
export const AI_MODEL = 'claude-haiku-5-5';

export type SuggestField =
  | 'seoTitle'
  | 'seoDescription'
  | 'excerpt'
  | 'focusKeyword'
  | 'tags'
  | 'alt'
  | 'caption'
  | 'mediaTags'
  | 'brandFix';

/** What each field is for and its length limit. The limit is the one the field is saved against. */
export const FIELD_SPECS: Record<SuggestField, { limit: number; brief: string }> = {
  seoTitle: {
    limit: SEO_TITLE_LIMIT,
    brief:
      'Write the search title for this post: what appears as the blue link in search results. Say what the post is about in plain words, and put the main subject first.',
  },
  seoDescription: {
    limit: SEO_DESCRIPTION_LIMIT,
    brief:
      'Write the search description for this post: one or two sentences under the search title that tell a reader what they will get from it. Do not repeat the title.',
  },
  excerpt: {
    limit: 500,
    brief:
      'Write the summary shown on blog cards: a sentence or two that makes someone want to read the post. Write it as a summary, not as the first paragraph.',
  },
  focusKeyword: {
    limit: FOCUS_KEYWORD_LIMIT,
    brief:
      'Choose the focus keyword: the short phrase, two to four words, that people would type into a search to find this post. Use words the post itself uses.',
  },
  tags: {
    limit: RELATED_TERM_LIMIT,
    brief:
      'Choose up to five tags for this post, only from the list of existing tags you are given. Pick the ones that fit best. Reply with their names exactly as written.',
  },
  alt: {
    limit: 300,
    brief:
      'Write the alt text for this image, for someone using a screen reader. Describe what is visible in under 125 characters. Do not begin with "image of" or "photo of". Do not guess who anyone is or where it was taken.',
  },
  caption: {
    limit: 500,
    brief:
      'Write a caption for this image: one short sentence shown to visitors under the picture. Say what is happening rather than what is obvious at a glance. Do not guess who anyone is or where it was taken.',
  },
  mediaTags: {
    limit: 40,
    brief:
      'Choose up to five short labels to help staff find this image in the media library, such as the subject or the season. Prefer labels from the list of tags already used in the library, and add a new one only when none of them fits. Write each in lower case, one or two words.',
  },
  brandFix: {
    limit: 2000,
    brief:
      'Rewrite only the text you are given, keeping its meaning and length close to the original. Replace the flagged word or phrase the way the guide says. Change nothing else.',
  },
};

const GENERAL_RULES = `Reply with the suggested text only: no quotation marks around it, no explanation, no label.
Write in Australian English, in sentence case. Never use an em dash or an en dash. Never use an exclamation mark.
Everything below the line is the brand guide. Follow it exactly: use the approved names, and never write a word it rules out.`;

/**
 * The brand guide goes first, as the stable part, then the brief for the field being written. The
 * cache mark sits on the guide alone: it is the same for every post and field, so calls within a few
 * minutes of each other read it from the cache at a tenth of the price instead of paying for it again.
 */
export function systemPrompt(brandGuide: string, field: SuggestField): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `${GENERAL_RULES}\n\n---\n\n${brandGuide}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `${FIELD_SPECS[field].brief}\nThe reply must be at most ${FIELD_SPECS[field].limit} characters.`,
    },
  ];
}
