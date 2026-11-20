// What only a super admin may do. The work is in super-admin-store.ts.
import { createServerFn } from '@tanstack/react-start';
import { getDb } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/session';
import { clearActivityEntries, resetAssistantCounts } from './super-admin-store';

/** Empties the activity log, leaving one entry that says who did it. */
export const clearActivityLog = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => ({
    cleared: await clearActivityEntries(getDb(), context.user),
  }));

/** Wipes every person's writing assistant counts, so the System page and daily limits start again. */
export const resetAssistantUsage = createServerFn({ method: 'POST' })
  .middleware([requireSuperAdmin])
  .handler(async ({ context }) => ({
    removed: await resetAssistantCounts(getDb(), context.user),
  }));
