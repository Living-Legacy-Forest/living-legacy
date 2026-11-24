import { describe, expect, it } from 'vitest';
import { isPasskeyCancel, passkeyResult } from './passkey-browser';

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

describe('passkeyResult', () => {
  it('returns the data of a call that worked', () => {
    expect(passkeyResult({ data: { id: 'p1' }, error: null })).toEqual({ id: 'p1' });
  });

  it('throws the reason of a call that failed, for the toast', () => {
    expect(() => passkeyResult({ data: null, error: { code: 'X', message: 'No room' } })).toThrow(
      'No room'
    );
  });

  it('throws a plain sentence when the failure has no reason', () => {
    expect(() => passkeyResult({ data: null, error: { status: 500 } })).toThrow(
      'Please try again.'
    );
  });

  it('returns null, with nothing to say, when the person closed the prompt', () => {
    expect(passkeyResult({ data: null, error: { code: 'AUTH_CANCELLED' } })).toBeNull();
  });
});
