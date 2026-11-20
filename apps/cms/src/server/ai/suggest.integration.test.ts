// The writing assistant's server side, against local D1 and R2 with a fake model.
import { media, siteSettings } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../../test/fixtures';
import { suggestAltTextFor, suggestBrandFixFor, suggestPostFieldFor } from './suggest';
import { aiEnabled, getAiClient } from './client';
import { loadAltImage } from './alt-image';
import type { AiClient } from './run';

const MB = 1024 * 1024;

function fakeClient(text = 'A calm place to walk.') {
  const parse = vi.fn().mockResolvedValue({
    parsed_output: { text },
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  return { client: { messages: { parse } } as unknown as AiClient, parse };
}

const bytes = (...values: number[]) => new Uint8Array(values);
const base64 = (data: Uint8Array) => Buffer.from(data).toString('base64');

async function addImage(opts: {
  id: string;
  mime?: string;
  original: Uint8Array;
  variants?: { width: number; data: Uint8Array; mime?: string }[];
  caption?: string | null;
  filename?: string;
}) {
  const variants = [];
  for (const v of opts.variants ?? []) {
    const key = `${opts.id}-w${v.width}`;
    await env.MEDIA.put(key, v.data);
    variants.push({ width: v.width, key, mime: v.mime ?? 'image/png' });
  }
  await env.MEDIA.put(`${opts.id}-orig`, opts.original);
  await testDb()
    .insert(media)
    .values({
      id: opts.id,
      r2Key: `${opts.id}-orig`,
      filename: opts.filename ?? 'secret-name.png',
      mime: opts.mime ?? 'image/png',
      size: opts.original.byteLength,
      variants: variants.length ? variants : null,
      caption: opts.caption ?? null,
    });
}

beforeEach(async () => {
  await testDb().delete(media);
  await testDb().delete(siteSettings);
  delete (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
});

describe('the key', () => {
  it('gives no client without a key, and one with it', () => {
    expect(getAiClient()).toBeNull();
    (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = 'test-key';
    expect(getAiClient()).not.toBeNull();
  });

  it('is enabled only with a key and a role that can edit something', () => {
    expect(aiEnabled('admin')).toBe(false);
    (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = 'test-key';
    expect(aiEnabled('admin')).toBe(true);
    expect(aiEnabled('author')).toBe(true);
    expect(aiEnabled('seo')).toBe(true);
    expect(aiEnabled('viewer')).toBe(false);
  });
});

describe('loadAltImage', () => {
  it('sends the largest variant up to 1568px wide rather than the original', async () => {
    await addImage({
      id: 'img1',
      original: bytes(1, 2, 3),
      variants: [
        { width: 640, data: bytes(7, 7, 7) },
        { width: 1200, data: bytes(9, 9, 9) },
        { width: 2400, data: bytes(5, 5, 5) },
      ],
    });
    const { block } = await loadAltImage(testDb(), env.MEDIA, 'img1');
    expect(block.source).toEqual({
      type: 'base64',
      media_type: 'image/png',
      data: base64(bytes(9, 9, 9)),
    });
  });

  it('sends the original when no variant fits', async () => {
    await addImage({ id: 'img2', original: bytes(1, 2, 3) });
    const { block } = await loadAltImage(testDb(), env.MEDIA, 'img2');
    expect(block.source).toMatchObject({ data: base64(bytes(1, 2, 3)) });
  });

  it('returns the caption as context', async () => {
    await addImage({ id: 'img3', original: bytes(1), caption: 'Planting day' });
    expect((await loadAltImage(testDb(), env.MEDIA, 'img3')).caption).toBe('Planting day');
  });

  it('refuses a file that is not a photo or image', async () => {
    await addImage({ id: 'svg', mime: 'image/svg+xml', original: bytes(1) });
    await expect(loadAltImage(testDb(), env.MEDIA, 'svg')).rejects.toThrow(
      'Alt text can only be suggested for photos and images.'
    );
  });

  it('refuses an image too large to send', async () => {
    await addImage({ id: 'big', original: new Uint8Array(6 * MB) });
    await expect(loadAltImage(testDb(), env.MEDIA, 'big')).rejects.toThrow(
      'This image is too large to describe. Replace it with a smaller copy.'
    );
  });

  it('says so when the image is gone', async () => {
    await expect(loadAltImage(testDb(), env.MEDIA, 'nope')).rejects.toThrow(
      'That image is no longer in Media.'
    );
  });
});

describe('suggestAltTextFor', () => {
  it('sends the image and never the filename', async () => {
    await addImage({ id: 'img4', original: bytes(1, 2, 3), filename: 'secret-name.png' });
    const { client, parse } = fakeClient('Sunlight through young trees.');
    const out = await suggestAltTextFor(testDb(), env.MEDIA, client, 'editor', { mediaId: 'img4' });
    expect(out).toEqual({ text: 'Sunlight through young trees.' });
    const content = parse.mock.calls[0]![0].messages[0].content;
    expect(content.some((b: { type: string }) => b.type === 'image')).toBe(true);
    expect(JSON.stringify(parse.mock.calls[0]![0])).not.toContain('secret-name');
  });

  it('needs permission to edit media', async () => {
    await addImage({ id: 'img5', original: bytes(1) });
    const { client, parse } = fakeClient();
    await expect(
      suggestAltTextFor(testDb(), env.MEDIA, client, 'seo', { mediaId: 'img5' })
    ).rejects.toThrow('You do not have permission to do that.');
    expect(parse).not.toHaveBeenCalled();
  });
});

describe('suggestPostFieldFor', () => {
  const post = {
    title: 'A walk in the forest',
    excerpt: '',
    bodyMarkdown: 'We walked under the trees.',
    tagNames: ['Events', 'Forests'],
  };

  it('asks for a search description and returns the text', async () => {
    const { client, parse } = fakeClient('A quiet walk among the trees.');
    const out = await suggestPostFieldFor(testDb(), client, 'author', {
      ...post,
      field: 'seoDescription',
    });
    expect(out).toEqual({ text: 'A quiet walk among the trees.' });
    expect(JSON.stringify(parse.mock.calls[0]![0].messages)).toContain('A walk in the forest');
  });

  it('does not call the model for a post with nothing written', async () => {
    const { client, parse } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, 'author', {
        field: 'excerpt',
        title: '  ',
        excerpt: '',
        bodyMarkdown: '',
        tagNames: [],
      })
    ).rejects.toThrow('Write some of the post first.');
    expect(parse).not.toHaveBeenCalled();
  });

  it('uses the brand rules saved in Settings', async () => {
    await testDb()
      .insert(siteSettings)
      .values({
        id: 'site',
        data: { brandRules: [{ match: 'tranquil', instead: 'calm', severity: 'critical' }] },
      });
    const { client, parse } = fakeClient('A tranquil walk.');
    parse.mockResolvedValueOnce({
      parsed_output: { text: 'A tranquil walk.' },
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    parse.mockResolvedValueOnce({
      parsed_output: { text: 'A calm walk.' },
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const out = await suggestPostFieldFor(testDb(), client, 'editor', {
      ...post,
      field: 'seoDescription',
    });
    expect(out).toEqual({ text: 'A calm walk.' });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('returns tags only from the existing list, in the list spelling', async () => {
    const parse = vi.fn().mockResolvedValue({
      parsed_output: { tags: ['events', 'Forests'] },
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const out = await suggestPostFieldFor(
      testDb(),
      { messages: { parse } } as unknown as AiClient,
      'editor',
      { ...post, field: 'tags' }
    );
    expect(out).toEqual({ tags: ['Events', 'Forests'] });
  });

  it('is not allowed for a viewer', async () => {
    const { client } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, 'viewer', { ...post, field: 'excerpt' })
    ).rejects.toThrow('You do not have permission to do that.');
  });
});

describe('suggestBrandFixFor', () => {
  it('rewrites the sentence and holds it to the limit it was given', async () => {
    const { client } = fakeClient('Choose a tree today.');
    const out = await suggestBrandFixFor(testDb(), client, 'editor', {
      text: 'Choose a plot today.',
      found: 'plot',
      limit: 60,
    });
    expect(out).toEqual({ text: 'Choose a tree today.' });
  });

  it('says the assistant is not set up when there is no client', async () => {
    await expect(
      suggestBrandFixFor(testDb(), null, 'editor', {
        text: 'Choose a plot today.',
        found: 'plot',
        limit: 60,
      })
    ).rejects.toThrow("The writing assistant isn't set up.");
  });
});
