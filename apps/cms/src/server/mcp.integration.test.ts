import type { Role } from '@ll/content';
import { apiKeys, posts } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from '@/lib/api-keys';
import { addUser, testDb } from '../../test/fixtures';
import { handleMcpPost } from './mcp';

beforeAll(() => {
  env.BETTER_AUTH_URL = 'https://cms.example.test';
});

beforeEach(async () => {
  await testDb().delete(posts);
});

async function addKey(scope: 'read' | 'write', role: Role = 'admin') {
  const { key, prefix } = generateApiKey();
  await testDb()
    .insert(apiKeys)
    .values({
      name: 'Claude',
      prefix,
      keyHash: await hashApiKey(key),
      scope,
      createdBy: await addUser(role),
    });
  return key;
}

const post = (key: string | null, body: unknown, headers: Record<string, string> = {}) =>
  handleMcpPost(
    new Request('https://cms.example.test/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
    })
  );

async function rpc(key: string, method: string, params: Record<string, unknown> = {}) {
  const response = await post(key, { jsonrpc: '2.0', id: 1, method, params });
  expect(response.status).toBe(200);
  // Replies are checked field by field, so a loose type keeps the tests readable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await response.json()) as { result?: any; error?: { code: number; message: string } };
}

async function call(key: string, name: string, args: Record<string, unknown> = {}) {
  const { result } = await rpc(key, 'tools/call', { name, arguments: args });
  const text = result.content[0].text as string;
  return { isError: result.isError === true, text, json: () => JSON.parse(text) };
}

describe('the MCP endpoint', () => {
  it('agrees a protocol version and explains the drafts-only rule', async () => {
    const key = await addKey('read');
    const { result } = await rpc(key, 'initialize', { protocolVersion: '2025-06-18' });
    expect(result.protocolVersion).toBe('2025-06-18');
    expect(result.capabilities).toEqual({ tools: {}, resources: {} });
    expect(result.instructions).toContain('get_brand_guide');

    const newer = await rpc(key, 'initialize', { protocolVersion: '2099-01-01' });
    expect(newer.result.protocolVersion).toBe('2025-11-25');
  });

  it('turns away requests without a key, from another origin or in a batch', async () => {
    const key = await addKey('read');
    const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
    expect((await post(null, ping)).status).toBe(401);
    expect((await post(key, ping, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(key, ping, { Origin: 'https://cms.example.test' })).status).toBe(200);
    expect((await post(key, ping, { 'MCP-Protocol-Version': '1999-01-01' })).status).toBe(400);
    expect((await post(key, [ping])).status).toBe(400);
  });

  it('accepts notifications without a reply, and names methods it lacks', async () => {
    const key = await addKey('read');
    const note = await post(key, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(note.status).toBe(202);
    const { error } = await rpc(key, 'prompts/list');
    expect(error?.code).toBe(-32601);
  });

  it('shows write tools only to a key that can write', async () => {
    const names = async (key: string) =>
      (await rpc(key, 'tools/list')).result.tools.map((t: { name: string }) => t.name);
    expect(await names(await addKey('read'))).not.toContain('create_draft');
    expect(await names(await addKey('write', 'viewer'))).not.toContain('create_draft');
    const writer = await names(await addKey('write'));
    expect(writer).toEqual(expect.arrayContaining(['create_draft', 'update_draft', 'check_post']));

    const { result } = await rpc(await addKey('write'), 'tools/list');
    const create = result.tools.find((t: { name: string }) => t.name === 'create_draft');
    expect(create.inputSchema.required).toEqual(['title']);
    expect(create.inputSchema.properties.markdown.description).toContain('Markdown');
    expect(create.inputSchema.$schema).toBeUndefined();
  });

  it('refuses a write from a read-only key as a tool error', async () => {
    const result = await call(await addKey('read'), 'create_draft', { title: 'Nope' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('can only read');
    expect(await testDb().select().from(posts)).toHaveLength(0);
  });

  it('creates a draft from Markdown and reads it back as Markdown', async () => {
    const key = await addKey('write');
    const created = await call(key, 'create_draft', {
      title: 'Planting day',
      markdown: '## A quiet morning\n\nWe planted **twelve** trees.',
      tags: ['Community'],
    });
    expect(created.isError).toBe(false);
    const { id, status } = created.json();
    expect(status).toBe('draft');

    const read = (await call(key, 'get_post', { id })).json();
    expect(read.content.markdown).toBe('## A quiet morning\n\nWe planted **twelve** trees.');
    expect(read.content.body).toBeUndefined();
    expect(read.content.tags).toEqual(['Community']);
  });

  it('reports invalid arguments so the model can fix them', async () => {
    const key = await addKey('write');
    const result = await call(key, 'create_draft', { title: 'x', slug: 'Not A Slug' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('slug');
    const missing = await call(key, 'get_post', { id: 'nope' });
    expect(missing).toMatchObject({ isError: true, text: 'No post has that id.' });
  });

  it('will not replace a body Markdown cannot hold unless asked to', async () => {
    const key = await addKey('write');
    const [row] = await testDb()
      .insert(posts)
      .values({
        title: 'With a photo',
        slug: 'with-a-photo',
        status: 'draft',
        body: {
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: '/api/media/m1' } },
            { type: 'paragraph', content: [{ type: 'text', text: 'Caption' }] },
          ],
        },
      })
      .returning();

    const read = (await call(key, 'get_post', { id: row!.id })).json();
    expect(read.content.editorOnly).toEqual(['image']);

    const refused = await call(key, 'update_draft', { id: row!.id, markdown: 'New words' });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('replaceBody');

    const titleOnly = await call(key, 'update_draft', { id: row!.id, title: 'Renamed' });
    expect(titleOnly.isError).toBe(false);

    const replaced = await call(key, 'update_draft', {
      id: row!.id,
      markdown: 'New words',
      replaceBody: true,
    });
    expect(replaced.json().content.markdown).toBe('New words');
  });

  it('checks wording and scores a post', async () => {
    const key = await addKey('write');
    const words = (await call(key, 'check_text', { text: 'Choose a plot today.' })).json();
    expect(words.problems[0]).toMatchObject({ found: 'plot', severity: 'critical' });

    const { id } = (
      await call(key, 'create_draft', { title: 'Visiting', markdown: 'Visit the grave.' })
    ).json();
    const checked = (await call(key, 'check_post', { id })).json();
    expect(checked.checked).toBe('draft');
    expect(typeof checked.score).toBe('number');
    expect(checked.brand.map((b: { found: string }) => b.found)).toContain('grave');

    const [stored] = await testDb().select().from(posts).where(eq(posts.id, id));
    expect(stored?.status).toBe('draft');
  });

  it('serves the brand guide as a tool and a resource', async () => {
    const key = await addKey('read');
    const guide = await call(key, 'get_brand_guide');
    expect(guide.text).toContain('EarthSApHE');
    const { result } = await rpc(key, 'resources/read', { uri: 'cms://guides/brand-language' });
    expect(result.contents[0].text).toBe(guide.text);
  });
});
