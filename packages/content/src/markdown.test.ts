import { describe, expect, it } from 'vitest';
import { markdownToRichText } from './markdown';
import { isAllowedRichText } from './posts';

const blocks = (md: string) => markdownToRichText(md).content ?? [];

describe('markdownToRichText', () => {
  it('turns headings into h2 to h4, with # promoted to h2', () => {
    expect(blocks('# Title\n### Part')).toEqual([
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Part' }] },
    ]);
  });

  it('joins wrapped lines into one paragraph and splits on blank lines', () => {
    expect(blocks('one\ntwo\n\nthree')).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'one two' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
    ]);
  });

  it('reads bold, italic, code and nested marks', () => {
    expect(blocks('**bold _both_** and `x`')[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold ', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'both', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'x', marks: [{ type: 'code' }] },
      ],
    });
  });

  it('keeps safe links and drops unsafe ones to plain text', () => {
    expect(blocks('[site](https://example.com) [bad](javascript:alert(1))')[0]).toEqual({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'site',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'bad' },
        { type: 'text', text: ')' },
      ],
    });
  });

  it('builds bullet and ordered lists, keeping a start number', () => {
    expect(blocks('- a\n- b\n\n3. c\n4. d')).toEqual([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'd' }] }],
          },
        ],
      },
    ]);
  });

  it('handles quotes, rules and code blocks', () => {
    expect(blocks('> said\n\n---\n\n```\nlet x\n```').map((b) => b?.type)).toEqual([
      'blockquote',
      'horizontalRule',
      'codeBlock',
    ]);
  });

  it('always produces content the editor accepts', () => {
    const md =
      '# A\n\nText with **bold**, *it*, `c` and [l](/faqs/).\n\n- one\n1. two\n\n> q\n\n---';
    expect(isAllowedRichText(markdownToRichText(md))).toBe(true);
  });
});
