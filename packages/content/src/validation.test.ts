import { describe, expect, it } from 'vitest';
import {
  auContactPhone,
  emailSchema,
  isEmail,
  isWebUrl,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalWebUrlSchema,
  wholeNumberSchema,
} from './validation';

describe('isEmail', () => {
  it.each([
    'name@example.com',
    'first.last+tag@sub.example.com.au',
    "o'brien@example.org",
    'a@b.co',
    'NAME@Example.COM',
  ])('accepts %s', (v) => expect(isEmail(v)).toBe(true));

  it.each([
    '',
    'name',
    'name@',
    '@example.com',
    'name@example',
    'name@example.c',
    'na me@example.com',
    '.name@example.com',
    'name.@example.com',
    'na..me@example.com',
    'name@-example.com',
    'name@example..com',
    'name@exa_mple.com',
    'a@b@example.com',
    'name@example.com, other@example.com',
    `${'a'.repeat(65)}@example.com`,
    `a@${'b'.repeat(250)}.com`,
  ])('rejects %j', (v) => expect(isEmail(v)).toBe(false));
});

describe('email schemas', () => {
  it('trims and lower-cases', () => {
    expect(emailSchema().parse('  Sam@Example.COM ')).toBe('sam@example.com');
  });
  it('lets an optional one be empty but not wrong', () => {
    expect(optionalEmailSchema().parse('')).toBe('');
    expect(optionalEmailSchema().safeParse('nope').success).toBe(false);
    expect(optionalEmailSchema().parse(undefined)).toBe('');
  });
});

describe('isWebUrl', () => {
  it.each([
    'https://example.com',
    'http://www.example.com.au/a/b?c=d#e',
    'https://sub.example.co.uk:8443/x',
    'https://xn--bcher-kva.example/',
  ])('accepts %s', (v) => expect(isWebUrl(v)).toBe(true));

  it.each([
    '',
    'example.com',
    'https://',
    'https://x',
    'https://localhost:3000',
    'https://192.168.0.1/',
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'https://example.com/a b',
    'https://example..com',
    `https://example.com/${'a'.repeat(2000)}`,
  ])('rejects %j', (v) => expect(isWebUrl(v)).toBe(false));

  it('lets an optional link be empty but not wrong', () => {
    expect(optionalWebUrlSchema().parse('')).toBe('');
    expect(optionalWebUrlSchema().safeParse('example.com').success).toBe(false);
  });
});

describe('auContactPhone', () => {
  it.each([
    ['0412345678', '0412 345 678'],
    ['+61 412 345 678', '0412 345 678'],
    ['(03) 7019-6142', '03 7019 6142'],
    ['1300 123 456', '1300 123 456'],
    ['1800123456', '1800 123 456'],
    ['131 234', '13 12 34'],
  ])('formats %s', (input, out) => expect(auContactPhone(input)).toBe(out));

  it.each(['', 'abc', '12345', '0112345678', '1900 123 456', '+1 202 555 0100', '0412 345'])(
    'rejects %j',
    (v) => expect(auContactPhone(v)).toBeNull()
  );

  it('saves one format and lets the field be empty', () => {
    expect(optionalPhoneSchema().parse('  0412345678 ')).toBe('0412 345 678');
    expect(optionalPhoneSchema().parse('')).toBe('');
    expect(optionalPhoneSchema().safeParse('call me').success).toBe(false);
  });
});

describe('wholeNumberSchema', () => {
  const order = wholeNumberSchema('Order', 0, 9999);
  it('accepts whole numbers in range', () => {
    expect(order.parse(0)).toBe(0);
    expect(order.parse(9999)).toBe(9999);
  });
  it.each([-1, 10000, 1.5, Number.NaN, Infinity])('rejects %s with one clear message', (v) => {
    const result = order.safeParse(v);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Order must be a whole number from 0 to 9,999.');
    }
  });
  it('rejects a string, where a number was expected', () => {
    expect(order.safeParse('5').success).toBe(false);
  });
});
