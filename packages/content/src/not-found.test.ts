import { describe, expect, it } from 'vitest';
import { notFoundPathKey } from './not-found';

describe('notFoundPathKey', () => {
  it('normalises a path the way redirects match it', () => {
    expect(notFoundPathKey('/Old-Page/')).toBe('/old-page');
    expect(notFoundPathKey('/blog/2019/05/a-post')).toBe('/blog/2019/05/a-post');
  });

  it('keeps old WordPress pages and uploads, which deserve a redirect', () => {
    expect(notFoundPathKey('/wp-content/uploads/2020/01/brochure.pdf')).toBe(
      '/wp-content/uploads/2020/01/brochure.pdf'
    );
  });

  it('ignores bot probes, browser icon requests and build files', () => {
    for (const path of [
      '/wp-login.php',
      '/wp-admin/install.php',
      '/xmlrpc.php',
      '/index.php',
      '/.env',
      '/.git/config',
      '/phpmyadmin/',
      '/apple-touch-icon-precomposed.png',
      '/favicon.ico',
      '/_astro/index.abc123.js',
      '/cdn-cgi/l/email-protection',
      '/.well-known/security.txt',
    ]) {
      expect(notFoundPathKey(path), path).toBeNull();
    }
  });

  it('refuses paths too long to be a real page', () => {
    expect(notFoundPathKey(`/${'a'.repeat(400)}`)).toBeNull();
  });
});
