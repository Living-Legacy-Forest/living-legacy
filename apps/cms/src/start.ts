import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rejects cross-site writes (server function POSTs, auth POSTs). Safe methods
// are skipped so links from email and Google's OAuth callback still load.
//
// The API (/api/v1) is skipped too: it never reads the session cookie, only
// an "Authorization: Bearer" key, which another site cannot make a visitor's
// browser send. Cross-site request forgery needs ambient credentials; the API
// has none, and its callers (scripts, automations) send no Origin header.
const isApi = (request: Request) => new URL(request.url).pathname.startsWith('/api/v1/');

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: ({ request }) => !safeMethods.has(request.method) && !isApi(request),
    }),
  ],
}));
