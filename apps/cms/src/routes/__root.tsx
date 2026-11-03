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
import { getSiteTheme, getSiteTimeZone } from '@/server/settings';
import styles from '../styles.css?url';

// Runs before hydration so a "system" preference never flashes the wrong
// colour scheme: the explicit light/dark cases are already resolved
// server-side via the <html class> below.
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;if(d.dataset.themePref==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches){d.classList.add('dark');}}catch(e){}})();`;

export const Route = createRootRoute({
  loader: async () => {
    const [theme, timeZone] = await Promise.all([getSiteTheme(), getSiteTimeZone()]);
    return { theme, timeZone };
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
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
