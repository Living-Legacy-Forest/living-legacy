/**
 * A booking's event as a calendar file (.ics), for the "add to calendar" link
 * in HubSpot's emails. Built on each request, so a moved event shows its new time.
 */
import { eventIcs } from '@ll/content';
import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/lib/db';
import { findTicket } from '@/server/tickets';

export const Route = createFileRoute('/api/tickets/$reference/calendar')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ticket = await findTicket(getDb(), params.reference);
        if (!ticket) return new Response('Not found', { status: 404 });
        return new Response(eventIcs(ticket), {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${ticket.reference}.ics"`,
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      },
    },
  },
});
