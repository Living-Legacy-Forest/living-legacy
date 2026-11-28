import { type Access, type HomePage, type Permission, can } from '@ll/content';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie, setCookie } from '@tanstack/react-start/server';
import { readSiteSettings } from './site-settings';

// Where the CMS opens when someone signs in (Settings, General, Default home page).

const PAGES: Record<HomePage, { to: string; permission?: Permission }> = {
  dashboard: { to: '/' },
  posts: { to: '/posts' },
  calendar: { to: '/calendar' },
  events: { to: '/events/overview', permission: 'events:manage' },
  media: { to: '/media', permission: 'media:write' },
  analytics: { to: '/analytics', permission: 'posts:publish' },
};

/** The page's address, or the dashboard's when this person cannot open it. */
export function homePagePath(page: HomePage, access: Access) {
  const { to, permission } = PAGES[page];
  return !permission || can(access, permission) ? to : PAGES.dashboard.to;
}

/** Set with the first visit of a browser session, so the dashboard link still opens the dashboard. */
const LAUNCHED_COOKIE = 'cms_launched';

/**
 * The page to send this person to when they open the CMS at its front door, or null to stay on
 * the dashboard. Only the first time in a browser session: after that "/" is the dashboard, so
 * its link in the sidebar works and a reload doesn't throw you off the page. Moving around inside
 * the app never redirects, which is why the browser's side of this does nothing.
 */
export const launchRedirect = createIsomorphicFn()
  .server(async (access: Access): Promise<string | null> => {
    if (getCookie(LAUNCHED_COOKIE)) return null;
    setCookie(LAUNCHED_COOKIE, '1', { path: '/', sameSite: 'lax', httpOnly: true });
    const { homePage } = await readSiteSettings();
    const to = homePagePath(homePage, access);
    return to === '/' ? null : to;
  })
  .client(async (): Promise<string | null> => null);
