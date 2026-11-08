import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { firstIssue, readStatus, readYesNo } from './bulk-import';

describe('readStatus', () => {
  it('treats blank as draft and ignores case and spaces', () => {
    expect(readStatus('')).toBe('draft');
    expect(readStatus(' Draft ')).toBe('draft');
    expect(readStatus('PUBLISHED')).toBe('published');
  });

  it('rejects anything else', () => {
    expect(readStatus('live')).toBeNull();
  });
});

describe('readYesNo', () => {
  it.each(['', 'no', 'False', '0'])('reads %j as no', (value) => {
    expect(readYesNo(value)).toBe(false);
  });

  it.each(['yes', 'TRUE', '1'])('reads %j as yes', (value) => {
    expect(readYesNo(value)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(readYesNo('maybe')).toBeNull();
  });
});

describe('firstIssue', () => {
  it('names the column of the first problem', () => {
    const result = z.object({ email: z.email('Not an email.') }).safeParse({ email: 'nope' });
    expect(firstIssue(result.error!)).toBe('email: Not an email.');
  });

  it('gives the bare message when no column is involved', () => {
    const result = z.string('Must be text.').safeParse(1);
    expect(firstIssue(result.error!)).toBe('Must be text.');
  });
});
