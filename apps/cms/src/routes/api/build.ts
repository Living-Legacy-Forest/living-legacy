/**
 * Which build is deployed, so tabs opened before a deploy can offer a reload
 * (components/shell/updates.tsx). Public and tiny: a commit id says nothing
 * that the dashboard's version line does not already show.
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/build')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { commit: import.meta.env.VITE_APP_COMMIT },
          { headers: { 'Cache-Control': 'no-store' } }
        ),
    },
  },
});
