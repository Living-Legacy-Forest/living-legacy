import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from '@sentry/tanstackstart-react';
import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rejects cross-site writes (server function POSTs, auth POSTs). Safe methods
// are skipped so links from email and Google's OAuth callback still load.
//
// The API (/api/v1) and the MCP server (/mcp) are skipped too: they never read
// the session cookie, only an "Authorization: Bearer" key, which another site
// cannot make a visitor's browser send. Cross-site request forgery needs
// ambient credentials; they have none, and their callers (scripts, automations,
// AI tools) send no Origin header. /mcp checks Origin itself when one is sent.
const isApi = (request: Request) => {
  const { pathname } = new URL(request.url);
  return pathname.startsWith('/api/v1/') || pathname === '/mcp';
};

// Sentry's middleware goes first so it sees errors from everything after it.
export const startInstance = createStart(() => ({
  functionMiddleware: [sentryGlobalFunctionMiddleware],
  requestMiddleware: [
    sentryGlobalRequestMiddleware,
    createCsrfMiddleware({
      filter: ({ request }) => !safeMethods.has(request.method) && !isApi(request),
    }),
  ],
}));
