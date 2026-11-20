import { type PostInput, type RichTextDoc, richTextToMarkdown } from '@ll/content';
import { suggestPostField } from '@/server/ai';

type TextField = 'seoTitle' | 'seoDescription' | 'excerpt' | 'focusKeyword';

/** What the assistant is shown of a post: its own title, summary and body, and nothing else. */
function postParts(values: PostInput, tagNames: string[]) {
  return {
    title: values.title,
    excerpt: values.excerpt,
    bodyMarkdown: richTextToMarkdown(values.body as RichTextDoc | null).markdown,
    tagNames,
  };
}

export async function suggestPostText(field: TextField, values: PostInput): Promise<string> {
  const out = await suggestPostField({ data: { field, ...postParts(values, []) } });
  if (!('text' in out)) throw new Error('The writing assistant sent back something unexpected.');
  return out.text;
}

export async function suggestPostTags(values: PostInput, tagNames: string[]): Promise<string[]> {
  const out = await suggestPostField({ data: { field: 'tags', ...postParts(values, tagNames) } });
  if (!('tags' in out)) throw new Error('The writing assistant sent back something unexpected.');
  return out.tags;
}
