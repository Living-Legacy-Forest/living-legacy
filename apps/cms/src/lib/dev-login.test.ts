import { describe, expect, it } from 'vitest';
import { isLocalHost, parkDevLoginLink, takeDevLoginLink } from './dev-login';

describe('isLocalHost', () => {
  it('accepts localhost and the loopback address', () => {
    expect(isLocalHost('http://localhost:3100/login')).toBe(true);
    expect(isLocalHost('http://127.0.0.1:3100/login')).toBe(true);
  });

  it('refuses any other host, including look-alikes', () => {
    expect(isLocalHost('https://cms.example.com/login')).toBe(false);
    expect(isLocalHost('https://localhost.example.com/login')).toBe(false);
    expect(isLocalHost('https://example.com/localhost')).toBe(false);
  });
});

describe('parked sign-in links', () => {
  it('hands a link back once, then forgets it', () => {
    parkDevLoginLink('a@example.com', 'http://localhost:3100/api/auth/verify');
    expect(takeDevLoginLink('a@example.com')).toBe('http://localhost:3100/api/auth/verify');
    expect(takeDevLoginLink('a@example.com')).toBeUndefined();
  });
});
