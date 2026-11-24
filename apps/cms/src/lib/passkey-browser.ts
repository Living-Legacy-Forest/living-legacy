// Browser-side passkey helpers: whether this browser can use passkeys, and telling a closed prompt
// apart from a real failure.

/** Codes the passkey client returns when the person closed the prompt or it timed out. */
const CANCEL_CODES = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  // The browser's own NotAllowedError, which is what closing the prompt raises.
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
]);

/** True when a passkey attempt ended because the person backed out, which needs no message. */
export function isPasskeyCancel(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'NotAllowedError' || error.name === 'AbortError';
  }
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return typeof error.code === 'string' && CANCEL_CODES.has(error.code);
}

/** Whether this browser can sign in with a passkey at all. */
export function supportsPasskeys(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/** Whether this browser can offer saved passkeys from the email field's autofill. */
export async function supportsPasskeyAutofill(): Promise<boolean> {
  if (!supportsPasskeys()) return false;
  try {
    return (await PublicKeyCredential.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Unwraps a passkey client call for `useAction()`: the data when it worked, null when the person
 * closed the prompt (nothing to say), and a thrown Error carrying the reason when it failed, so the
 * runner's toast and pending reset apply. Network failures already throw on their own.
 */
export function passkeyResult<T>(result: {
  data: T | null;
  error: { message?: string; code?: string; status?: number } | null;
}): T | null {
  if (!result.error) return result.data;
  if (isPasskeyCancel(result.error)) return null;
  throw new Error(result.error.message || 'Please try again.');
}

/** Sent on window when a passkey is added elsewhere on the page, so lists of them reload. */
export const PASSKEYS_CHANGED = 'll:passkeys-changed';
