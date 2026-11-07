// Missing pages: paths the website answered with "not found", collected so
// someone can redirect the ones people still follow (old links after the move
// to the national site). Bots probing for weaknesses and browsers asking for
// icons would bury those, so they are not recorded.

import { normalizePath } from './redirects';

/** Longer than any page address the site has had; a longer one is a probe or junk. */
const MAX_LENGTH = 300;

const NOISE = [
  /\.php(\/|$)/, // the old site's pages had clean addresses; .php is a probe
  /^\/wp-(admin|login|includes)/,
  /^\/\.|\/\./, // dotfiles and folders: /.env, /.git/config, /.well-known/...
  /^\/phpmyadmin/,
  /^\/(apple-touch-icon|favicon|android-chrome|mstile)/,
  /^\/_astro\//,
  /^\/cdn-cgi\//,
];

/** The key a missing path is counted under, or null if it is not worth recording. */
export function notFoundPathKey(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (path.length > MAX_LENGTH) return null;
  return NOISE.some((pattern) => pattern.test(path)) ? null : path;
}
