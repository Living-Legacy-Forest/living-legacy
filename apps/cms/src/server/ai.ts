// The writing assistant's server functions. They only wrap src/server/ai/suggest.ts, which holds
// the logic; keeping the heavy imports there means the browser build never has to resolve them.
import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { getDb } from '@/lib/db';
import { authMiddleware, requirePermission } from '@/lib/session';
import { aiEnabled, getAiClient } from './ai/client';
import { altTextSchema, brandFixSchema, postFieldSchema } from './ai/schemas';
import {
  suggestAltTextFor,
  suggestBrandFixFor,
  suggestMediaCaptionFor,
  suggestMediaTagsFor,
  suggestPostFieldFor,
} from './ai/suggest';

export const suggestPostField = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(postFieldSchema)
  .handler(({ data, context }) => suggestPostFieldFor(getDb(), getAiClient(), context.user, data));

export const suggestAltText = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(altTextSchema)
  .handler(({ data, context }) =>
    suggestAltTextFor(getDb(), env.MEDIA, getAiClient(), context.user, data)
  );

export const suggestMediaCaption = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(altTextSchema)
  .handler(({ data, context }) =>
    suggestMediaCaptionFor(getDb(), env.MEDIA, getAiClient(), context.user, data)
  );

export const suggestMediaTags = createServerFn({ method: 'POST' })
  .middleware([requirePermission('media:write')])
  .validator(altTextSchema)
  .handler(({ data, context }) =>
    suggestMediaTagsFor(getDb(), env.MEDIA, getAiClient(), context.user, data)
  );

export const suggestBrandFix = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(brandFixSchema)
  .handler(({ data, context }) => suggestBrandFixFor(getDb(), getAiClient(), context.user, data));

/** Whether to show the Suggest buttons to this person. */
export const getAiStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => ({ enabled: aiEnabled(context.user.role) }));
