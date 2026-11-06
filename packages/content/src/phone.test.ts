import { describe, expect, it } from 'vitest';
import { auPhone } from './phone';

describe('auPhone', () => {
  it.each([
    ['0412345678', '0412 345 678'],
    ['0412 345 678', '0412 345 678'],
    ['0412-345-678', '0412 345 678'],
    ['+61412345678', '0412 345 678'],
    ['+61 412 345 678', '0412 345 678'],
    ['61412345678', '0412 345 678'],
    ['+61 (0)412 345 678', '0412 345 678'],
    ['0370196142', '03 7019 6142'],
    ['(03) 7019 6142', '03 7019 6142'],
    ['+61 3 7019 6142', '03 7019 6142'],
    ['02 9999 0000', '02 9999 0000'],
    ['07 3000 0000', '07 3000 0000'],
    ['08 9000 0000', '08 9000 0000'],
  ])('reads %s as %s', (input, expected) => {
    expect(auPhone(input)).toBe(expected);
  });

  it.each([
    ['too short', '041234567'],
    ['too long', '04123456789'],
    ['no area code', '70196142'],
    ['another country', '+1 415 555 2671'],
    ['New Zealand', '+64 21 123 4567'],
    ['a business number', '1300 123 456'],
    ['a freecall number', '1800 123 456'],
    ['not a mobile or area code', '0512 345 678'],
    ['letters', '0412 ABC 678'],
    ['an extension', '03 7019 6142 ext 4'],
    ['a plus in the wrong place', '04+12345678'],
    ['empty', ''],
  ])('refuses %s', (_, input) => {
    expect(auPhone(input)).toBeNull();
  });
});
