import { FileQuestionIcon } from '@/components/icons';
import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
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

export const Route = createRootRoute({
  loader: () => getRootSettings(),
  // Otherwise this reloads on every navigation. Saving settings invalidates it.
  staleTime: 5 * 60_000,
  head: () => ({
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
      // The same icons as the public website (apps/web/public), so the CMS tab
      // is recognisable among the site's own.
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'icon', type: 'image/png', href: '/icon-192.png', sizes: '192x192' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { theme } = Route.useLoaderData();
  useThemeSync(theme);

  return (
    <html
      lang="en-AU"
      data-theme-pref={theme}
      className={theme === 'dark' ? 'dark' : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
        {/* Here, not in head(): it keeps one meta per name, and "system" needs two. */}
        {themeColorMeta(theme).map((meta) => (
          <meta key={meta.media ?? 'all'} name="theme-color" {...meta} />
        ))}
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        {/* On phones toasts sit at the bottom, above the tab bar. */}
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
