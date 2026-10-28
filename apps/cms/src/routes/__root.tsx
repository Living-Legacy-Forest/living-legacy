import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import styles from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Living Legacy Forest CMS' },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
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
    <main className="grid min-h-svh place-items-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl">Page not found</h1>
        <p className="text-muted-foreground">This page does not exist or has been moved.</p>
        <Button render={<Link to="/" />}>Back to dashboard</Button>
      </div>
    </main>
  );
}
