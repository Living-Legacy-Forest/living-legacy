import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { type PostsDisplay, parsePostsDisplay } from './posts-display';

// Kept in a cookie, as the sidebar's layout is (sidebar-state.ts), so the server draws the first
// paint the way it was left and the list does not rearrange itself after loading.

const COOKIE = 'posts_display';
const ONE_YEAR = 60 * 60 * 24 * 365;

function read(header: string): PostsDisplay {
  const raw = header
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return parsePostsDisplay(null);
  try {
    return parsePostsDisplay(decodeURIComponent(raw));
  } catch {
    return parsePostsDisplay(null);
  }
}

export const readPostsDisplay = createIsomorphicFn()
  .server(() => read(getRequest().headers.get('cookie') ?? ''))
  .client(() => read(document.cookie));

export function rememberPostsDisplay(display: PostsDisplay) {
  const value = encodeURIComponent(JSON.stringify(display));
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
