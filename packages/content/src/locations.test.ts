import { describe, expect, it } from 'vitest';
import { richTextToStored, storedToRichText } from './locations';
import type { RichTextDoc } from './posts';

describe('a location about, as stored', () => {
  const doc: RichTextDoc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Among the gums.' }] }],
  };

  it('comes back as it was saved', () => {
    expect(storedToRichText(richTextToStored(doc))).toEqual(doc);
  });

  it('stores nothing when empty', () => {
    expect(richTextToStored(null)).toBeNull();
    expect(storedToRichText(null)).toBeNull();
    expect(storedToRichText('')).toBeNull();
    expect(storedToRichText('   ')).toBeNull();
  });

  it('reads text written before the rich editor, keeping paragraphs and links', () => {
    const read = storedToRichText('First paragraph.\n\nSee [the map](https://example.com).');
    expect(read?.content).toHaveLength(2);
    expect(read?.content?.[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'First paragraph.' }],
    });
    expect(JSON.stringify(read?.content?.[1])).toContain('https://example.com');
  });

  it('treats text that only looks like JSON as text', () => {
    const read = storedToRichText('{not json} is how it starts');
    expect(JSON.stringify(read)).toContain('{not json} is how it starts');
  });

  it('treats JSON that is not an allowed document as text, not as a document', () => {
    const read = storedToRichText('{"type":"script","content":[]}');
    expect(read?.type).toBe('doc');
    expect(JSON.stringify(read?.content)).not.toContain('"type":"script"');
  });
});
