/**
 * POST /mcp  The CMS as an MCP server, for AI tools (src/server/mcp.ts).
 * Authenticate with an API key: "Authorization: Bearer llk_…".
 */
import { createFileRoute } from '@tanstack/react-router';
import { handleMcpPost } from '@/server/mcp';

// No server-sent event stream and no sessions, so GET and DELETE are refused
// as the spec describes for a server without them.
const notAllowed = () =>
  new Response('This MCP server only answers POST requests.', {
    status: 405,
    headers: { Allow: 'POST' },
  });

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpPost(request),
      GET: notAllowed,
      DELETE: notAllowed,
    },
  },
});
