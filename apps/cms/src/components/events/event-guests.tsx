import { toCsv } from '@ll/content';
import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, DownloadIcon, MoreHorizontalIcon, UserPlusIcon } from '@/components/icons';
import { SearchInput, matchesSearch } from '@/components/list/list-tools';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import type { EventRow } from '@/server/events';
import { type Guest, cancelGuest, getGuests, setCheckedIn } from '@/server/event-guests';
import { AddGuestDialog } from './add-guest-dialog';

const fullName = (g: Guest) => [g.firstName, g.lastName].filter(Boolean).join(' ');
const places = (n: number) => (n === 1 ? '1 place' : `${n} places`);

/** Who is coming to an event: counts, search, check-in, add, cancel and export. */
export function EventGuests({ event }: { event: EventRow }) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [toCancel, setToCancel] = useState<Guest | null>(null);
  const { run } = useAction();
  const zone = useTimeZone();

  const reload = useCallback(
    () =>
      getGuests({ data: { eventId: event.id } })
        .then(setGuests)
        .catch((error) => notify.error('Could not load the guest list', error)),
    [event.id]
  );
  useEffect(() => {
    setGuests(null);
    void reload();
  }, [reload]);

  if (guests === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const confirmed = guests.filter((g) => g.status === 'confirmed');
  const cancelled = guests.filter((g) => g.status === 'cancelled');
  const booked = confirmed.reduce((n, g) => n + g.partySize, 0);
  const arrived = confirmed.reduce((n, g) => n + (g.checkedInAt === null ? 0 : g.partySize), 0);
  const matches = (g: Guest) =>
    matchesSearch(query, [g.firstName, g.lastName, g.email, g.phone, g.reference]);
  const editable = event.status !== 'cancelled';

  const replace = (id: string, checkedInAt: number | null) =>
    setGuests((list) => list && list.map((g) => (g.id === id ? { ...g, checkedInAt } : g)));

  // Shows straight away, then confirms with the server; puts it back if that fails.
  async function toggleCheckIn(g: Guest) {
    const checkedIn = g.checkedInAt === null;
    replace(g.id, checkedIn ? Date.now() : null);
    try {
      const result = await setCheckedIn({ data: { id: g.id, checkedIn } });
      replace(g.id, result.checkedInAt);
    } catch (error) {
      replace(g.id, g.checkedInAt);
      notify.error('Could not update the check-in', error);
    }
  }

  function exportCsv() {
    const rows = [
      [
        'Reference',
        'First name',
        'Last name',
        'Email',
        'Phone',
        'Party size',
        'Note',
        'Status',
        'Checked in',
        'Booked at',
      ],
      ...guests!.map((g) => [
        g.reference,
        g.firstName,
        g.lastName,
        g.email,
        g.phone,
        String(g.partySize),
        g.note,
        g.status === 'confirmed' ? 'Confirmed' : 'Cancelled',
        g.checkedInAt === null ? '' : formatDateTime(g.checkedInAt, zone),
        formatDateTime(g.createdAt, zone),
      ]),
    ];
    const filename = `guests-${event.slug}.csv`;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
    notify.success({
      title: 'Guest list exported',
      description: `${guests!.length} ${guests!.length === 1 ? 'booking' : 'bookings'} in ${filename}.`,
    });
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat
          label="Booked"
          value={event.capacity === null ? `${booked}` : `${booked} of ${event.capacity}`}
        />
        <Stat label="Bookings" value={`${confirmed.length}`} />
        <Stat label="Checked in" value={`${arrived} of ${booked}`} />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          label="Search guests"
          placeholder="Name, email or reference"
          value={query}
          onChange={setQuery}
        />
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={guests.length === 0}
            onClick={exportCsv}
          >
            <DownloadIcon aria-hidden data-icon="inline-start" />
            Export CSV
          </Button>
          {editable && (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <UserPlusIcon aria-hidden data-icon="inline-start" />
              Add guest
            </Button>
          )}
        </div>
      </div>

      {confirmed.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          No guests yet. Add phone bookings and walk-ins here.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {confirmed.filter(matches).map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
              <GuestDetails guest={g} />
              {editable && (
                <>
                  <Button
                    type="button"
                    variant={g.checkedInAt === null ? 'outline' : 'secondary'}
                    aria-pressed={g.checkedInAt !== null}
                    className="min-h-11 min-w-28 shrink-0 sm:min-h-9"
                    onClick={() => toggleCheckIn(g)}
                  >
                    {g.checkedInAt === null ? (
                      'Check in'
                    ) : (
                      <>
                        <CheckIcon aria-hidden data-icon="inline-start" />
                        Checked in
                      </>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More for ${fullName(g)}`}
                          className="shrink-0"
                        />
                      }
                    >
                      <MoreHorizontalIcon aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" onClick={() => setToCancel(g)}>
                        Cancel booking
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {cancelled.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium">Cancelled</h3>
          <ul className="divide-y rounded-lg border opacity-70">
            {cancelled.filter(matches).map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                <GuestDetails guest={g} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddGuestDialog event={event} open={adding} onOpenChange={setAdding} onAdded={reload} />

      <AlertDialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel {toCancel ? `${fullName(toCancel)}'s` : 'this'} booking?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their places are freed for others. They are not emailed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const g = toCancel;
                if (!g) return;
                setToCancel(null);
                const done = await run(
                  async () => {
                    await cancelGuest({ data: { id: g.id } });
                    return true;
                  },
                  {
                    success: {
                      title: 'Booking cancelled',
                      description: `${places(g.partySize)} freed for others.`,
                    },
                    error: 'Could not cancel the booking',
                  }
                );
                if (done) await reload();
              }}
            >
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-2 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function GuestDetails({ guest: g }: { guest: Guest }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{fullName(g)}</span>
        {g.partySize > 1 && (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {g.partySize} people
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground truncate text-xs">
        <span className="font-mono">{g.reference}</span>
        {g.email && ` · ${g.email}`}
        {!g.email && g.phone && ` · ${g.phone}`}
      </div>
      {g.note && <div className="text-muted-foreground mt-0.5 text-xs">{g.note}</div>}
    </div>
  );
}
