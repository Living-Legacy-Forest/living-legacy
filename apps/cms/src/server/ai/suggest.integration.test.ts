// The writing assistant's server side, against local D1 and R2 with a fake model.
import type { Role } from '@ll/content';
import { aiUsage, media, siteSettings } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, testDb } from '../../../test/fixtures';
import {
  suggestAltTextFor,
  suggestBrandFixFor,
  suggestMediaCaptionFor,
  suggestMediaTagsFor,
  suggestPostFieldFor,
} from './suggest';
import { aiEnabled, getAiClient } from './client';
import { loadAltImage } from './alt-image';
import type { AiClient } from './run';
import { usageDay } from './usage';

const MB = 1024 * 1024;

/** A reply as the API sends it: JSON as text. */
const answer = (out: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(out) }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
});

function fakeClient(text = 'A calm place to walk.') {
  const create = vi.fn().mockResolvedValue({
    ...answer({ text }),
  });
  return { client: { messages: { create } } as unknown as AiClient, create };
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

// The person asking. Each test gets a fresh one, so what they have used today starts at nothing.
let me: string;
const actor = (role: Role = 'editor') => ({ id: me, role });
const usedToday = async () =>
  (await testDb().select().from(aiUsage)).reduce((sum, row) => sum + row.count, 0);

beforeEach(async () => {
  me = await addUser();
  await testDb().delete(aiUsage);
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
  it('sends the largest stored copy up to 1024px wide, which is plenty to describe it', async () => {
    await addImage({
      id: 'img1',
      original: bytes(1, 2, 3),
      variants: [
        { width: 320, data: bytes(1, 1, 1) },
        { width: 640, data: bytes(7, 7, 7) },
        { width: 1280, data: bytes(9, 9, 9) },
      ],
    });
    const { block } = await loadAltImage(testDb(), env.MEDIA, 'img1');
    expect(block.source).toEqual({
      type: 'base64',
      media_type: 'image/png',
      data: base64(bytes(7, 7, 7)),
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
    const { client, create } = fakeClient('Sunlight through young trees.');
    const out = await suggestAltTextFor(testDb(), env.MEDIA, client, actor('editor'), {
      mediaId: 'img4',
    });
    expect(out).toEqual({ text: 'Sunlight through young trees.' });
    const content = create.mock.calls[0]![0].messages[0].content;
    expect(content.some((b: { type: string }) => b.type === 'image')).toBe(true);
    expect(JSON.stringify(create.mock.calls[0]![0])).not.toContain('secret-name');
  });

  it('needs permission to edit media', async () => {
    await addImage({ id: 'img5', original: bytes(1) });
    const { client, create } = fakeClient();
    await expect(
      suggestAltTextFor(testDb(), env.MEDIA, client, actor('seo'), { mediaId: 'img5' })
    ).rejects.toThrow('You do not have permission to do that.');
    expect(create).not.toHaveBeenCalled();
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
    const { client, create } = fakeClient('A quiet walk among the trees.');
    const out = await suggestPostFieldFor(testDb(), client, actor('author'), {
      ...post,
      field: 'seoDescription',
    });
    expect(out).toEqual({ text: 'A quiet walk among the trees.' });
    expect(JSON.stringify(create.mock.calls[0]![0].messages)).toContain('A walk in the forest');
  });

  it('does not call the model for a post with nothing written', async () => {
    const { client, create } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, actor('author'), {
        field: 'excerpt',
        title: '  ',
        excerpt: '',
        bodyMarkdown: '',
        tagNames: [],
      })
    ).rejects.toThrow('Write some of the post first.');
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the brand rules saved in Settings', async () => {
    await testDb()
      .insert(siteSettings)
      .values({
        id: 'site',
        data: { brandRules: [{ match: 'tranquil', instead: 'calm', severity: 'critical' }] },
      });
    const { client, create } = fakeClient('A tranquil walk.');
    create.mockResolvedValueOnce({
      ...answer({ text: 'A tranquil walk.' }),
    });
    create.mockResolvedValueOnce({
      ...answer({ text: 'A calm walk.' }),
    });
    const out = await suggestPostFieldFor(testDb(), client, actor('editor'), {
      ...post,
      field: 'seoDescription',
    });
    expect(out).toEqual({ text: 'A calm walk.' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  const tagsFrom = (tags: string[]) => {
    const create = vi.fn().mockResolvedValue(answer({ tags }));
    return { client: { messages: { create } } as unknown as AiClient, create };
  };

  it('returns tags only from the existing list, in the list spelling', async () => {
    const { client } = tagsFrom(['events', 'Forests']);
    const out = await suggestPostFieldFor(testDb(), client, actor('editor'), {
      ...post,
      field: 'tags',
    });
    expect(out).toEqual({ tags: ['Events', 'Forests'] });
  });

  it('drops a tag that is not in the list or breaks the guide, and keeps the rest', async () => {
    const { client, create } = tagsFrom(['events', 'Gardening', 'Plots']);
    const out = await suggestPostFieldFor(testDb(), client, actor('editor'), {
      ...post,
      tagNames: ['Events', 'Forests', 'Plots'],
      field: 'tags',
    });
    expect(out).toEqual({ tags: ['Events'] });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('says so when none of the suggested tags can be used', async () => {
    const { client } = tagsFrom(['Gardening']);
    await expect(
      suggestPostFieldFor(testDb(), client, actor('editor'), { ...post, field: 'tags' })
    ).rejects.toThrow("Couldn't find tags that fit this post. Choose them yourself.");
  });

  it('keeps at most five tags', async () => {
    const names = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
    const { client } = tagsFrom(names);
    const out = await suggestPostFieldFor(testDb(), client, actor('editor'), {
      ...post,
      tagNames: names,
      field: 'tags',
    });
    expect(out).toEqual({ tags: names.slice(0, 5) });
  });

  it('sends at most the first 12,000 characters of a long post, and says it was cut', async () => {
    const { client, create } = fakeClient('A long walk.');
    await suggestPostFieldFor(testDb(), client, actor('editor'), {
      ...post,
      bodyMarkdown: 'word '.repeat(10_000),
      field: 'seoDescription',
    });
    const text: string = create.mock.calls[0]![0].messages[0].content[0].text;
    expect(text.length).toBeLessThan(13_000);
    expect(text).toContain('The post continues');
  });

  it('is not allowed for a viewer', async () => {
    const { client } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, actor('viewer'), { ...post, field: 'excerpt' })
    ).rejects.toThrow('You do not have permission to do that.');
  });
});

describe('suggestBrandFixFor', () => {
  it('rewrites the sentence and holds it to the limit it was given', async () => {
    const { client } = fakeClient('Choose a tree today.');
    const out = await suggestBrandFixFor(testDb(), client, actor('editor'), {
      text: 'Choose a plot today.',
      found: 'plot',
      limit: 60,
    });
    expect(out).toEqual({ text: 'Choose a tree today.' });
  });

  it('says the assistant is not set up when there is no client', async () => {
    await expect(
      suggestBrandFixFor(testDb(), null, actor('editor'), {
        text: 'Choose a plot today.',
        found: 'plot',
        limit: 60,
      })
    ).rejects.toThrow("The writing assistant isn't set up.");
  });
});

describe('the daily limit', () => {
  const post = { title: 'A walk', excerpt: '', bodyMarkdown: 'We walked.', tagNames: [] };
  const useUpTheDay = (n: number) =>
    testDb()
      .insert(aiUsage)
      .values({ userId: me, day: usageDay(new Date(), 'Australia/Melbourne'), count: n });

  it('counts one suggestion per press, even when the reply is retried', async () => {
    const { client, create } = fakeClient('Choose a plot today.');
    create.mockResolvedValueOnce(answer({ text: 'Choose a plot today.' }));
    create.mockResolvedValueOnce(answer({ text: 'Choose a tree today.' }));
    await suggestPostFieldFor(testDb(), client, actor(), { ...post, field: 'excerpt' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(await usedToday()).toBe(1);
  });

  it('stops before the model once the day is used up, and says so', async () => {
    await useUpTheDay(100);
    const { client, create } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, actor(), { ...post, field: 'excerpt' })
    ).rejects.toThrow("You've used today's 100 suggestions. They start again at midnight.");
    expect(create).not.toHaveBeenCalled();
  });

  it('does not use one up when the press fails before reaching the model', async () => {
    const { client } = fakeClient();
    await expect(
      suggestPostFieldFor(testDb(), client, actor(), {
        field: 'excerpt',
        title: '',
        excerpt: '',
        bodyMarkdown: '',
        tagNames: [],
      })
    ).rejects.toThrow('Write some of the post first.');
    await expect(
      suggestPostFieldFor(testDb(), client, actor('viewer'), { ...post, field: 'excerpt' })
    ).rejects.toThrow('You do not have permission to do that.');
    await expect(
      suggestAltTextFor(testDb(), env.MEDIA, client, actor(), { mediaId: 'gone' })
    ).rejects.toThrow('That image is no longer in Media.');
    expect(await usedToday()).toBe(0);
  });

  it('counts alt text and brand fixes too', async () => {
    await addImage({ id: 'limit-img', original: bytes(1, 2, 3) });
    const { client } = fakeClient('Sunlight through young trees.');
    await suggestAltTextFor(testDb(), env.MEDIA, client, actor(), { mediaId: 'limit-img' });
    await suggestBrandFixFor(testDb(), fakeClient('Choose a tree today.').client, actor(), {
      text: 'Choose a plot today.',
      found: 'plot',
      limit: 60,
    });
    expect(await usedToday()).toBe(2);
  });
});

describe('suggestMediaCaptionFor', () => {
  it('writes a caption from the image, with the caption brief, and counts one', async () => {
    await addImage({ id: 'cap1', original: bytes(1, 2, 3), filename: 'secret-name.png' });
    const { client, create } = fakeClient('Morning light on the new planting.');
    const out = await suggestMediaCaptionFor(testDb(), env.MEDIA, client, actor(), {
      mediaId: 'cap1',
    });
    expect(out).toEqual({ text: 'Morning light on the new planting.' });
    const sent = create.mock.calls[0]![0];
    expect(sent.messages[0].content.some((b: { type: string }) => b.type === 'image')).toBe(true);
    expect(JSON.stringify(sent.system)).toContain('caption');
    expect(JSON.stringify(sent)).not.toContain('secret-name');
    expect(await usedToday()).toBe(1);
  });

  it('holds the caption to the brand guide', async () => {
    await addImage({ id: 'cap2', original: bytes(1) });
    const { client, create } = fakeClient();
    create.mockResolvedValueOnce(answer({ text: 'A quiet plot.' }));
    create.mockResolvedValueOnce(answer({ text: 'A quiet place.' }));
    const out = await suggestMediaCaptionFor(testDb(), env.MEDIA, client, actor(), {
      mediaId: 'cap2',
    });
    expect(out).toEqual({ text: 'A quiet place.' });
  });

  it('refuses a file that is not a photo or image, and a role without media access', async () => {
    await addImage({ id: 'cap3', mime: 'image/svg+xml', original: bytes(1) });
    const { client } = fakeClient();
    await expect(
      suggestMediaCaptionFor(testDb(), env.MEDIA, client, actor(), { mediaId: 'cap3' })
    ).rejects.toThrow('Alt text can only be suggested for photos and images.');
    await expect(
      suggestMediaCaptionFor(testDb(), env.MEDIA, client, actor('seo'), { mediaId: 'cap3' })
    ).rejects.toThrow('You do not have permission to do that.');
    expect(await usedToday()).toBe(0);
  });
});

describe('suggestMediaTagsFor', () => {
  const tagsFrom = (tags: string[]) => {
    const create = vi.fn().mockResolvedValue(answer({ tags }));
    return { client: { messages: { create } } as unknown as AiClient, create };
  };

  it('tidies the labels the way the library stores them and drops repeats', async () => {
    await addImage({ id: 'tag1', original: bytes(1, 2, 3) });
    const { client } = tagsFrom(['Tree Planting', 'tree-planting', 'Forest!']);
    const out = await suggestMediaTagsFor(testDb(), env.MEDIA, client, actor(), {
      mediaId: 'tag1',
    });
    expect(out).toEqual({ tags: ['tree-planting', 'forest'] });
  });

  it('drops a label that breaks the brand guide and keeps the rest', async () => {
    await addImage({ id: 'tag2', original: bytes(1) });
    const { client } = tagsFrom(['plots', 'forest']);
    const out = await suggestMediaTagsFor(testDb(), env.MEDIA, client, actor(), {
      mediaId: 'tag2',
    });
    expect(out).toEqual({ tags: ['forest'] });
  });

  it('keeps at most five', async () => {
    await addImage({ id: 'tag3', original: bytes(1) });
    const { client } = tagsFrom(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
    const out = await suggestMediaTagsFor(testDb(), env.MEDIA, client, actor(), {
      mediaId: 'tag3',
    });
    expect(out).toEqual({ tags: ['a1', 'a2', 'a3', 'a4', 'a5'] });
  });

  it('says so when no label is usable', async () => {
    await addImage({ id: 'tag4', original: bytes(1) });
    const { client } = tagsFrom(['plots']);
    await expect(
      suggestMediaTagsFor(testDb(), env.MEDIA, client, actor(), { mediaId: 'tag4' })
    ).rejects.toThrow("Couldn't find tags that fit this image. Choose them yourself.");
  });

  it('tells the model which tags the library already uses, most used first', async () => {
    await addImage({ id: 'tag5', original: bytes(1) });
    await addImage({ id: 'tag5b', original: bytes(2) });
    await testDb()
      .update(media)
      .set({ tags: ['events', 'forest'] })
      .where(eq(media.id, 'tag5'));
    await testDb()
      .update(media)
      .set({ tags: ['forest'] })
      .where(eq(media.id, 'tag5b'));
    const { client, create } = tagsFrom(['forest']);
    await suggestMediaTagsFor(testDb(), env.MEDIA, client, actor(), { mediaId: 'tag5' });
    const text = JSON.stringify(create.mock.calls[0]![0].messages);
    expect(text).toContain('already used in the library: forest, events');
  });
});
