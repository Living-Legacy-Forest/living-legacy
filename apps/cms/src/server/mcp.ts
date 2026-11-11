/**
 * The CMS as an MCP server (POST /mcp), so AI tools such as Claude can read
 * posts and write drafts. It is the /api/v1 API in another shape: the same API
 * keys, the same operations (src/server/api-v1.ts), and the same rule that
 * nothing it writes goes live until a person publishes it in the CMS.
 *
 * Stateless Streamable HTTP: each POST carries one JSON-RPC message and gets
 * a JSON reply. There are no sessions and no server-sent events, which the
 * spec allows, and which suits a Worker. Hand-written rather than the SDK,
 * whose validator compiles schemas with `new Function`, which Workers forbid.
 */
import {
  type PostInput,
  type RichTextDoc,
  analysePost,
  findBrandProblems,
  guidelinesFromSettings,
  richTextToMarkdown,
  scoreBand,
} from '@ll/content';
import type { Db } from '@ll/db';
import { posts } from '@ll/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import brandGuide from '../../../../docs/brand-language.md?raw';
import { type ApiActor, authenticateApiRequest, canWrite } from '@/lib/api-keys';
import { getDb } from '@/lib/db';
import { cmsOrigin } from '@/lib/email';
import {
  ApiFailure,
  createPostDraft,
  describeIssues,
  getPost,
  listPostsPage,
  listTerms,
  postStatusFilters,
  updatePost,
  writeFields,
} from './api-v1';
import { loadContentTargets } from './post-score';
import { liveInput } from './post-store';

/** Newest first. A client asking for one we do not know gets the newest. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

const SERVER_INFO = { name: 'living-legacy-cms', title: 'Living Legacy CMS', version: '1.0.0' };

const INSTRUCTIONS = `Read and draft blog posts for the Living Legacy website.

- Writing only ever creates or edits drafts. A person reviews and publishes them in the CMS, so tell the user to do that when a draft is ready.
- Before writing or changing anything a visitor will read, call get_brand_guide and follow it: the approved names, the words never to use, Australian English, sentence case, no em or en dashes and no exclamation marks.
- Post bodies are Markdown. After writing, call check_post and fix anything critical.
- Categories are set by id (list_terms); tags are names, and new ones are created.`;

const BRAND_GUIDE_URI = 'cms://guides/brand-language';

// ---------------------------------------------------------------------------
// Tools

type Context = { db: Db; actor: ApiActor };

type Tool<S extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Needs a write key. Hidden from read-only keys. */
  write?: boolean;
  run: (args: z.infer<S>, ctx: Context) => Promise<unknown>;
};

const tool = <S extends z.ZodType>(t: Tool<S>) => t as unknown as Tool;

const postId = z.string().min(1).describe('The post id, from list_posts.');

// What the model may send. `body` (editor JSON), the robots switches and the
// canonical URL stay REST-only: Markdown is the body a model writes well, and
// the others are SEO decisions.
const draftFields = {
  markdown: writeFields.markdown.describe(
    'The body in Markdown: ## to #### headings, paragraphs, - and 1. lists, > quotes, ``` code, ---, **bold**, *italic*, `code` and [links](https://…). Start with ##; the title is the page heading.'
  ),
  excerpt: writeFields.excerpt.describe('One or two sentences for post lists and search results.'),
  slug: writeFields.slug.describe(
    'The address, in lowercase letters, numbers and hyphens. Leave out to make one from the title.'
  ),
  tags: writeFields.tags.describe('Tag names. Unknown tags are created.'),
  categoryIds: writeFields.categoryIds.describe('Category ids from list_terms.'),
  seoTitle: writeFields.seoTitle.describe('The title for search results, if not the post title.'),
  seoDescription: writeFields.seoDescription.describe('The description for search results.'),
  socialTitle: writeFields.socialTitle.describe(
    'The title on social share cards, if not the search title.'
  ),
  socialDescription: writeFields.socialDescription.describe(
    'The description on social share cards, if not the search description.'
  ),
};

const tools: Tool[] = [
  tool({
    name: 'list_posts',
    title: 'List posts',
    description:
      'Posts, newest change first, without their bodies. "all" leaves out the trash. Filter by status or words in the title.',
    input: z
      .object({
        status: z.enum(postStatusFilters).optional(),
        query: z.string().max(100).optional().describe('Words in the title.'),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    run: ({ status, query, page, pageSize }, { db }) =>
      listPostsPage(db, { status, q: query, page, pageSize }),
  }),
  tool({
    name: 'get_post',
    title: 'Read a post',
    description:
      'One post in full, its body as Markdown. For a published post with edits waiting, `content` is the live version and `unpublishedChanges` the waiting one. `editorOnly` lists anything in the body that Markdown cannot hold, such as images or tables.',
    input: z.object({ id: postId }).strict(),
    run: async ({ id }, { db }) => forModel(await getPost(db, id)),
  }),
  tool({
    name: 'list_terms',
    title: 'List categories and tags',
    description: 'Every category (with the id to send) and tag.',
    input: z.object({}).strict(),
    run: (_, { db }) => listTerms(db),
  }),
  tool({
    name: 'get_brand_guide',
    title: 'Read the brand language guide',
    description:
      'How Living Legacy writes: tone, the approved names and the words never to use. Read it before writing anything a visitor will see.',
    input: z.object({}).strict(),
    run: async () => brandGuide,
  }),
  tool({
    name: 'check_text',
    title: 'Check wording',
    description:
      'Finds words the brand guide rules out, with what to write instead. Quick to run on a passage before it goes into a draft.',
    input: z.object({ text: z.string().min(1).max(200_000) }).strict(),
    // The list as edited in Settings, the same one posts are scored against.
    run: async ({ text }, { db }) => ({
      problems: findBrandProblems(text, (await loadContentTargets(db)).brandRules),
    }),
  }),
  tool({
    name: 'check_post',
    title: 'Check a post',
    description:
      "The CMS content score for a post's waiting version (its draft, or edits waiting on a live post): the score, the checks it misses and any ruled-out words.",
    input: z.object({ id: postId }).strict(),
    run: async ({ id }, { db }) => {
      const row = await db.query.posts.findFirst({ where: eq(posts.id, id) });
      if (!row) throw new ApiFailure(404, 'No post has that id.');
      const input = await waitingVersion(db, row);
      const result = analysePost(
        input,
        guidelinesFromSettings(await loadContentTargets(db), input)
      );
      return {
        checked:
          row.status === 'published' ? (row.draft ? 'unpublished changes' : 'live') : 'draft',
        score: result.score,
        band: scoreBand(result.score).label,
        held: result.held,
        toFix: result.checks
          .filter((c) => c.status === 'critical' || c.status === 'warning')
          .map(({ category, status, message, why }) => ({ category, status, message, why })),
        brand: result.brand,
      };
    },
  }),
  tool({
    name: 'create_draft',
    title: 'Create a draft',
    description: 'A new draft post. It stays a draft until someone publishes it in the CMS.',
    write: true,
    input: z.object({ title: writeFields.title, ...partial(draftFields) }).strict(),
    run: async (args, { db, actor }) => forModel(await createPostDraft(db, actor, args)),
  }),
  tool({
    name: 'update_draft',
    title: 'Edit a post',
    description:
      'Changes only the fields sent. On a published post the edits wait as unpublished changes until someone publishes them in the CMS; the live page does not change. Trashed and scheduled posts cannot be edited here.',
    write: true,
    input: z
      .object({
        id: postId,
        title: writeFields.title.optional(),
        ...partial(draftFields),
        replaceBody: z
          .boolean()
          .optional()
          .describe(
            'Needed to send markdown for a post whose get_post shows editorOnly content, which the new body replaces.'
          ),
      })
      .strict(),
    run: async ({ id, replaceBody, ...data }, { db, actor }) => {
      if (data.markdown !== undefined && !replaceBody) {
        const row = await db.query.posts.findFirst({ where: eq(posts.id, id) });
        const lost = row ? richTextToMarkdown((await waitingVersion(db, row)).body).editorOnly : [];
        if (lost.length) {
          throw new ApiFailure(
            409,
            `This post's body has things Markdown cannot hold (${lost.join(', ')}), and new markdown would remove them. Send replaceBody: true to go ahead, or leave the body to someone in the CMS.`
          );
        }
      }
      return forModel(await updatePost(db, actor, id, data));
    },
  }),
];

function partial<T extends Record<string, z.ZodType>>(shape: T) {
  return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof T]: z.ZodOptional<T[K]>;
  };
}

/** The version an edit builds on, and that check_post scores. */
async function waitingVersion(db: Db, row: typeof posts.$inferSelect): Promise<PostInput> {
  const live = await liveInput(db, row);
  return row.draft ? ({ ...live, ...row.draft } as PostInput) : live;
}

type PostDetail = Awaited<ReturnType<typeof getPost>>;

/** A post with its bodies as Markdown, which a model reads and writes far better than editor JSON. */
function forModel(post: PostDetail) {
  const asMarkdown = <T extends { body: RichTextDoc | null }>({ body, ...rest }: T) => {
    const { markdown, editorOnly } = richTextToMarkdown(body);
    return { ...rest, markdown, ...(editorOnly.length ? { editorOnly } : {}) };
  };
  return {
    ...post,
    content: asMarkdown(post.content),
    unpublishedChanges: post.unpublishedChanges ? asMarkdown(post.unpublishedChanges) : null,
  };
}

const toolsFor = (actor: ApiActor) => tools.filter((t) => !t.write || canWrite(actor));

function describeTool(t: Tool) {
  const { $schema: _, ...inputSchema } = z.toJSONSchema(t.input, {
    io: 'input',
    unrepresentable: 'any',
  });
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema,
    annotations: {
      title: t.title,
      readOnlyHint: !t.write,
      destructiveHint: false,
      idempotentHint: !t.write,
      openWorldHint: false,
    },
  };
}

// Problems the model can fix come back as tool results with isError set, so it
// sees them and tries again; protocol problems are JSON-RPC errors.
const toolResult = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

async function callTool(params: Record<string, unknown>, ctx: Context) {
  const found = tools.find((t) => t.name === params.name);
  if (!found) throw new RpcError(INVALID_PARAMS, `There is no tool called ${String(params.name)}.`);
  if (found.write && !canWrite(ctx.actor)) {
    return toolResult(
      'This API key can only read. Create a key with write access in the CMS.',
      true
    );
  }
  const args = found.input.safeParse(params.arguments ?? {});
  if (!args.success) return toolResult(describeIssues(args.error), true);
  try {
    return toolResult(await found.run(args.data, ctx));
  } catch (error) {
    if (error instanceof ApiFailure) return toolResult(error.message, true);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
const RESOURCE_NOT_FOUND = -32002;

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
  }
}

type RpcId = string | number;

const rpcError = (id: RpcId | null, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status });

async function dispatch(method: string, params: Record<string, unknown>, ctx: Context) {
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      const known = PROTOCOL_VERSIONS.find((v) => v === asked);
      return {
        protocolVersion: known ?? PROTOCOL_VERSIONS[0],
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: toolsFor(ctx.actor).map(describeTool) };
    case 'tools/call':
      return callTool(params, ctx);
    case 'resources/list':
      return {
        resources: [
          {
            uri: BRAND_GUIDE_URI,
            name: 'brand-language',
            title: 'Brand language guide',
            description: 'Tone, approved names and words never to use.',
            mimeType: 'text/markdown',
          },
        ],
      };
    case 'resources/templates/list':
      return { resourceTemplates: [] };
    case 'resources/read':
      if (params.uri !== BRAND_GUIDE_URI) {
        throw new RpcError(RESOURCE_NOT_FOUND, `There is no resource at ${String(params.uri)}.`);
      }
      return { contents: [{ uri: BRAND_GUIDE_URI, mimeType: 'text/markdown', text: brandGuide }] };
    default:
      throw new RpcError(METHOD_NOT_FOUND, `This server does not support ${method}.`);
  }
}

/** Handles one POST to /mcp. */
export async function handleMcpPost(request: Request): Promise<Response> {
  // Browsers send Origin; other clients do not. A page elsewhere must not be
  // able to drive this with a key it has found (DNS rebinding).
  const origin = request.headers.get('origin');
  if (origin && origin !== cmsOrigin()) {
    return rpcError(null, INVALID_REQUEST, 'Requests from that origin are not allowed.', 403);
  }
  const version = request.headers.get('mcp-protocol-version');
  if (version && !(PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return rpcError(null, INVALID_REQUEST, `Unsupported protocol version ${version}.`, 400);
  }

  const actor = await authenticateApiRequest(request, 'read');
  if (actor instanceof Response) return actor;

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, PARSE_ERROR, 'The request body must be JSON.', 400);
  }
  if (Array.isArray(message)) {
    return rpcError(null, INVALID_REQUEST, 'Send one message per request.', 400);
  }
  const msg = (message ?? {}) as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  if (msg.jsonrpc !== '2.0') {
    return rpcError(null, INVALID_REQUEST, 'Expected a JSON-RPC 2.0 message.', 400);
  }

  // Notifications (no id) and the client's replies to us (no method) need no answer.
  const hasId = typeof msg.id === 'string' || typeof msg.id === 'number';
  if (!hasId || typeof msg.method !== 'string') return new Response(null, { status: 202 });
  const id = msg.id as RpcId;

  const params =
    msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params)
      ? (msg.params as Record<string, unknown>)
      : {};
  try {
    const result = await dispatch(msg.method, params, { db: getDb(), actor });
    return Response.json({ jsonrpc: '2.0', id, result });
  } catch (error) {
    if (error instanceof RpcError) return rpcError(id, error.code, error.message);
    console.error('MCP request failed', error);
    return rpcError(id, INTERNAL_ERROR, 'Something went wrong in the CMS. Try again.');
  }
}
