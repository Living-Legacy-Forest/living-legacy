/**
 * A ticket's QR code as a PNG, for the confirmation email HubSpot sends. Public:
 * the image holds only the booking reference, which is in the email anyway.
 */
import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/lib/db';
import { qrPng } from '@/server/qr-png';
import { findTicket } from '@/server/tickets';

export const Route = createFileRoute('/api/tickets/$reference/qr')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ticket = await findTicket(getDb(), params.reference);
        if (!ticket) return new Response('Not found', { status: 404 });
        return new Response(await qrPng(ticket.reference), {
          headers: {
            'Content-Type': 'image/png',
            // A reference never changes, so neither does its code.
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      },
    },
  },
});
