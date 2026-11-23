import { describe, expect, it } from 'vitest';
import { isPasskeyCancel } from './passkey-browser';

describe('isPasskeyCancel', () => {
  it('treats a closed or timed-out passkey prompt as a cancel', () => {
    expect(isPasskeyCancel({ code: 'AUTH_CANCELLED' })).toBe(true);
    expect(isPasskeyCancel({ code: 'ERROR_CEREMONY_ABORTED' })).toBe(true);
    expect(isPasskeyCancel({ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY' })).toBe(true);
    expect(isPasskeyCancel(new DOMException('closed', 'NotAllowedError'))).toBe(true);
    expect(isPasskeyCancel(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('does not hide real failures', () => {
    expect(isPasskeyCancel({ code: 'PASSKEY_NOT_FOUND' })).toBe(false);
    expect(isPasskeyCancel({ status: 403, message: 'passkeys_off' })).toBe(false);
    expect(isPasskeyCancel(new Error('boom'))).toBe(false);
    expect(isPasskeyCancel(null)).toBe(false);
  });
});
