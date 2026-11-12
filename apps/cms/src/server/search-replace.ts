import { searchReplaceSchema } from '@ll/content';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/session';
import { areaIds, findMatches, replaceMatches } from './search-replace-store';

export type { AreaId, AreaMatch, ItemMatch } from './search-replace-store';
export { areaLabels } from './search-replace-store';

/** Every match of the phrase, by area, for the preview. Changes nothing. */
export const searchContent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:replace')])
  .validator(searchReplaceSchema)
  .handler(({ data }) => findMatches(getDb(), data));

/** Replaces the phrase in the areas chosen, searching again first. */
export const replaceContent = createServerFn({ method: 'POST' })
  .middleware([requirePermission('content:replace')])
  .validator(
    searchReplaceSchema.extend({
      areas: z.array(z.enum(areaIds)).min(1, 'Choose where to replace.'),
    })
  )
  .handler(({ data, context }) =>
    replaceMatches(getDb(), data, data.areas, { id: context.user.id, name: context.user.name })
  );
