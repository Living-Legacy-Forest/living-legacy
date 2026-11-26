// What only a super admin may do. The work is in super-admin-store.ts.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/session';
import {
  clearActivityEntries,
  removeActivityEntry,
  resetAssistantCounts,
} from './super-admin-store';

/** Empties the activity log, leaving one entry that says who did it. */
export const clearActivityLog = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => ({
    cleared: await clearActivityEntries(getDb(), context.user),
  }));

/** Removes one entry from the activity log. Nothing is left in its place. */
export const removeActivityLogEntry = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => ({ removed: await removeActivityEntry(getDb(), data.id) }));

/** Wipes every person's writing assistant counts, so the System page and daily limits start again. */
export const resetAssistantUsage = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => ({
    removed: await resetAssistantCounts(getDb(), context.user),
  }));
