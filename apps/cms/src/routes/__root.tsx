import { FileQuestionIcon } from '@/components/icons';
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import { appearanceVars, iconSchemeScript } from '@ll/content';
import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { displayAttributes, readDisplayPrefs } from '@/lib/display-prefs';
import { setRegional } from '@/lib/regional';
import { wakeAudioOnGesture } from '@/lib/sound';
import { useThemeSync } from '@/lib/use-theme-sync';
import { type Theme, getRootSettings } from '@/server/settings';
import styles from '../styles.css?url';

// Runs before hydration so a "system" preference never flashes the wrong
// colour scheme: the explicit light/dark cases are already resolved
// server-side via the <html class> below.
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(d.dataset.themePref==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark');}}catch(e){}})();`;

// The phone's status bar and browser chrome take this colour; it matches the
// top bar's background (--background) in each scheme.
const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' };

function themeColorMeta(theme: Theme): { content: string; media?: string }[] {
  if (theme === 'light' || theme === 'dark') return [{ content: THEME_COLORS[theme] }];
  return [
    { media: '(prefers-color-scheme: light)', content: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', content: THEME_COLORS.dark },
  ];
}

const iconHref = (mediaId: string) => `/api/media/${mediaId}?w=640`;

// With a dark icon the tab's icon is not a link here: a script adds it (RootDocument), because
// React would otherwise hoist a second, light copy when it hydrates and the browser would keep
// that one. The home screen has no dark variant, so it keeps the main icon.
function iconLinks(siteIconMediaId: string | undefined, siteIconDarkMediaId: string | undefined) {
  if (siteIconDarkMediaId) {
    return [
      {
        rel: 'apple-touch-icon',
        href: siteIconMediaId ? iconHref(siteIconMediaId) : '/apple-touch-icon.png',
      },
    ];
  }
  if (siteIconMediaId) {
    const href = iconHref(siteIconMediaId);
    return [
      { rel: 'icon', href },
      { rel: 'apple-touch-icon', href },
    ];
  }
  return [
    { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
    { rel: 'icon', type: 'image/png', href: '/icon-192.png', sizes: '192x192' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  ];
}

export const Route = createRootRoute({
  loader: () => getRootSettings(),
  // Otherwise this reloads on every navigation. Saving settings invalidates it.
  staleTime: 5 * 60_000,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      // viewport-fit=cover lets the app paint under the notch and home bar;
      // the header and tab bar pad themselves back with the safe-area insets.
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Living Legacy CMS' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      // The same icon as the public website (Settings, Site icon, or the built-in
      // files in public/), so the CMS tab is recognisable among the site's own.
      ...iconLinks(loaderData?.siteIconMediaId, loaderData?.siteIconDarkMediaId),
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  const {
    theme,
    cmsFont,
    cmsColour,
    appearance,
    dateFormat,
    timeFormat,
    siteIconMediaId,
    siteIconDarkMediaId,
  } = Route.useLoaderData();
  // Before anything below draws a date: the server and the browser write the same text.
  setRegional({ dateFormat, timeFormat });
  const lightIcon = siteIconMediaId ? iconHref(siteIconMediaId) : '/icon-192.png';
  useThemeSync(theme);
  useEffect(() => wakeAudioOnGesture(), []);
  // iOS Safari shows :active (every control's pressed look) only on a page that listens for
  // touches; an empty, passive listener is enough, and costs nothing while scrolling.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  return (
    <html
      lang="en-AU"
      data-theme-pref={theme}
      data-font={cmsFont}
      // A person's own colour sets the --tint-* values inline, which the palette rules read.
      data-colour={appearance.colour ? 'custom' : cmsColour}
      {...displayAttributes(readDisplayPrefs())}
      style={appearanceVars(appearance) as CSSProperties}
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
        {siteIconDarkMediaId && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: iconSchemeScript(lightIcon, iconHref(siteIconDarkMediaId)),
              }}
            />
            {/* With scripts off the light icon still shows. */}
            <noscript>
              <link rel="icon" href={lightIcon} />
            </noscript>
          </>
        )}
        {/* Here, not in head(): it keeps one meta per name, and "system" needs two. */}
        {themeColorMeta(theme).map((meta) => (
          <meta key={meta.media ?? 'all'} name="theme-color" {...meta} />
        ))}
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        {/* Toasts drop from the top on phones (components/ui/sonner.tsx), bottom right elsewhere. */}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="flex min-h-svh p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>
            <h1>Page not found</h1>
          </EmptyTitle>
          <EmptyDescription>This page does not exist or has been moved.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" render={<Link to="/" />} nativeButton={false}>
            Back to dashboard
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
