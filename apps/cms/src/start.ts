import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rejects cross-site writes (server function POSTs, auth POSTs). Safe methods
// are skipped so links from email and Google's OAuth callback still load.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: ({ request }) => !safeMethods.has(request.method) }),
  ],
}));
