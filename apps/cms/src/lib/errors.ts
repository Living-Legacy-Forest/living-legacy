/**
 * A message fit for a toast. Server validation failures arrive as the JSON list
 * of problems, so the first problem's message is shown instead of the JSON.
 */
export function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.';
  try {
    const issues: unknown = JSON.parse(error.message);
    if (Array.isArray(issues)) {
      const message = (issues[0] as { message?: unknown } | undefined)?.message;
      if (typeof message === 'string') return message;
    }
  } catch {
    // Not JSON: an ordinary message, shown as it is.
  }
  return error.message;
}
