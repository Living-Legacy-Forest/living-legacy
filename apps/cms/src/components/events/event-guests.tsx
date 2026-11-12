import { toCsv } from '@ll/content';
import { useCallback, useEffect, useState } from 'react';
import {
  CheckIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  ScanQrIcon,
  UserPlusIcon,
} from '@/components/icons';
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
import { cn } from '@/lib/utils';
import type { EventRow } from '@/server/events';
import { type Guest, cancelGuest, getGuests, setCheckedIn } from '@/server/event-guests';
import { Reveal } from '@/components/reveal';
import { AddGuestDialog } from './add-guest-dialog';
import { TicketScanner } from './ticket-scanner';

const fullName = (g: Guest) => [g.firstName, g.lastName].filter(Boolean).join(' ');
const places = (n: number) => (n === 1 ? '1 place' : `${n} places`);

/** Who is coming to an event: counts, search, check-in, add, cancel and export. */
export function EventGuests({ event }: { event: EventRow }) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toCancel, setToCancel] = useState<Guest | null>(null);
  // Kept while the dialog closes, so its title does not change mid-animation.
  const [editing, setEditing] = useState<Guest | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { run } = useAction();
  const zone = event.timeZone;

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
    // The dates of a repeating event share an address, so the date tells the files apart.
    const day = new Date(event.startsAt).toLocaleDateString('en-CA', { timeZone: zone });
    const filename = `guests-${event.slug}-${day}.csv`;
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
        <div className="touch:w-full touch:*:min-h-11 touch:*:flex-1 ml-auto flex gap-2">
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
          {editable && confirmed.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setScanning(true)}>
              <ScanQrIcon aria-hidden data-icon="inline-start" />
              Scan tickets
            </Button>
          )}
          {editable && (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <UserPlusIcon aria-hidden data-icon="inline-start" />
              Add guest
            </Button>
          )}
        </div>
      </div>

      {confirmed.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm max-md:border-0 max-md:text-[0.9375rem]">
          No guests yet. Add phone bookings and walk-ins here.
        </p>
      ) : (
        <ul className={GUEST_LIST}>
          {confirmed.filter(matches).map((g) => (
            <li
              key={g.id}
              className={cn(
                'animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none',
                GUEST_ROW
              )}
            >
              <GuestDetails guest={g} />
              {editable && (
                <>
                  <Button
                    type="button"
                    variant={g.checkedInAt === null ? 'outline' : 'secondary'}
                    aria-pressed={g.checkedInAt !== null}
                    className="min-h-11 min-w-24 shrink-0 sm:min-h-9 sm:min-w-28"
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
                          className="touch:size-11 shrink-0"
                        />
                      }
                    >
                      <MoreHorizontalIcon aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(g);
                          setEditOpen(true);
                        }}
                      >
                        Edit booking
                      </DropdownMenuItem>
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

      <Reveal show={cancelled.length > 0}>
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium max-md:px-4 max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
            Cancelled
          </h3>
          <ul className={cn(GUEST_LIST, 'opacity-70')}>
            {cancelled.filter(matches).map((g) => (
              <li key={g.id} className={GUEST_ROW}>
                <GuestDetails guest={g} />
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      <AddGuestDialog event={event} open={adding} onOpenChange={setAdding} onAdded={reload} />
      <AddGuestDialog
        event={event}
        guest={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onAdded={reload}
      />
      <TicketScanner
        event={event}
        open={scanning}
        onOpenChange={setScanning}
        onChange={() => void reload()}
      />

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

/** Bordered on wider screens; an iOS grouped list on phones. */
const GUEST_LIST =
  'divide-y rounded-lg border max-md:divide-(--ios-separator) max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell-raised)';

/**
 * A guest beside their buttons. On phones the name stays beside them and the rest
 * runs the full width beneath, which leaves the longest lines the most room.
 */
const GUEST_ROW =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:flex sm:gap-y-0 max-md:px-4';

function GuestDetails({ guest: g }: { guest: Guest }) {
  return (
    <div className="contents sm:block sm:min-w-0 sm:flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 sm:flex-nowrap">
        {/* Finding the right person matters most at the door, so a phone shows all of a name. */}
        <span className="max-w-full truncate font-medium max-sm:wrap-break-word max-sm:whitespace-normal">
          {fullName(g)}
        </span>
        {g.partySize > 1 && (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {g.partySize} people
          </Badge>
        )}
      </div>
      <div className="order-last col-span-full min-w-0 sm:order-none">
        <div className="text-muted-foreground truncate text-xs">
          <span className="font-mono">{g.reference}</span>
          {g.email && ` · ${g.email}`}
          {!g.email && g.phone && ` · ${g.phone}`}
        </div>
        {g.note && <div className="text-muted-foreground mt-0.5 text-xs">{g.note}</div>}
      </div>
    </div>
  );
}
