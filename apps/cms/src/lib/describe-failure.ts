import { DrizzleQueryError } from 'drizzle-orm';

/**
 * What is safe to log about a failure. A failed Drizzle query throws a `DrizzleQueryError` whose
 * message is the SQL plus every bound value, and on a booking those are the guest's name, email,
 * phone and note. Its name stays "Error", so it is told apart by type (and by its shape, in case
 * a second copy of drizzle-orm is bundled): only the database's own reason is returned.
 */
export function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  if (
    error instanceof DrizzleQueryError ||
    'params' in error ||
    error.message.startsWith('Failed query:')
  ) {
    return `query failed: ${cause ?? 'no reason given'}`;
  }
  return cause ? `${error.message} (${cause})` : error.message;
}
