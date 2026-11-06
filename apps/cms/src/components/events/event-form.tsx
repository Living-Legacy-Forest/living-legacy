import { type EventInput, slugify } from '@ll/content';
import { useState } from 'react';
import { DateTimePicker } from '@/components/date-time-picker';
import { Trash2Icon } from '@/components/icons';
import { ImageField } from '@/components/media/image-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { notify, removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import {
  type EventRow,
  type LocationOption,
  cancelEvent,
  deleteEvent,
  saveEvent,
} from '@/server/events';

/** The form's buttons, laid out for the pane or the dialog; `start` holds cancel and delete. */
export type FormActions = (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode;

type Values = Omit<EventInput, 'id' | 'startsAt' | 'endsAt'> & {
  startsAt: number | null;
  endsAt: number | null;
};

const TWO_HOURS = 2 * 60 * 60 * 1000;
const NO_LOCATION = 'none';

function initialValues(event: EventRow | null): Values {
  if (!event) {
    return {
      title: '',
      slug: '',
      locationId: null,
      venue: '',
      startsAt: null,
      endsAt: null,
      summary: '',
      description: '',
      heroMediaId: null,
      capacity: null,
      maxPartySize: 6,
      bookingsCloseAt: null,
      status: 'draft',
    };
  }
  return {
    title: event.title,
    slug: event.slug,
    locationId: event.locationId,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    summary: event.summary,
    description: event.description,
    heroMediaId: event.heroMediaId,
    capacity: event.capacity,
    maxPartySize: event.maxPartySize,
    bookingsCloseAt: event.bookingsCloseAt,
    // A cancelled event is shown read-only, so this is never saved.
    status: event.status === 'published' ? 'published' : 'draft',
  };
}

export function EventForm({
  event,
  locations,
  onSaved,
  actions,
}: {
  event: EventRow | null;
  locations: LocationOption[];
  onSaved: (id: string | null) => void;
  actions: FormActions;
}) {
  const [values, setValues] = useState<Values>(() => initialValues(event));
  const patch = (next: Partial<Values>) => setValues((v) => ({ ...v, ...next }));
  const { run, pending } = useAction();
  const location = locations.find((l) => l.id === values.locationId);
  const locationItems = [
    { value: NO_LOCATION, label: 'No location' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  if (event?.status === 'cancelled') {
    return <CancelledEvent event={event} actions={actions} onRemoved={() => onSaved(null)} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const { startsAt, endsAt } = values;
    if (startsAt === null || endsAt === null) {
      notify.error('Check the event', 'Set when it starts and ends.');
      return;
    }
    const result = await run(
      () => saveEvent({ data: { ...values, id: event?.id, startsAt, endsAt } }),
      {
        success: {
          title: event ? 'Event saved' : 'Event created',
          description:
            values.status === 'published'
              ? 'Staff can add guests, and it is ready for the website.'
              : 'It is a draft. Staff can still add guests.',
        },
        error: 'Could not save the event',
      }
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Title</Label>
        <Input
          id="ev-title"
          required
          maxLength={120}
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Open day at Mornington"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-slug">Web address</Label>
        <Input
          id="ev-slug"
          maxLength={120}
          value={values.slug}
          onChange={(e) => patch({ slug: e.target.value })}
          placeholder={slugify(values.title) || 'open-day'}
          className="font-mono"
        />
        <p className="text-muted-foreground text-xs">
          Used for its page once the website shows events.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-location">Location</Label>
          <Select
            items={locationItems}
            value={values.locationId ?? NO_LOCATION}
            onValueChange={(value) => {
              const picked = locations.find((l) => l.id === value);
              patch({
                locationId: picked ? picked.id : null,
                // Fill the venue from the location, unless one was typed.
                ...(picked && !values.venue ? { venue: picked.address } : {}),
              });
            }}
          >
            <SelectTrigger id="ev-location" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-venue">Venue</Label>
          <Input
            id="ev-venue"
            maxLength={300}
            value={values.venue}
            onChange={(e) => patch({ venue: e.target.value })}
            placeholder={location?.address || 'Where to go'}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-starts">Starts</Label>
          <DateTimePicker
            id="ev-starts"
            value={values.startsAt}
            defaultTime="10:00"
            placeholder="Pick a date"
            onChange={(startsAt) =>
              patch({
                startsAt,
                // A first start time suggests a two-hour event.
                ...(startsAt !== null && values.endsAt === null
                  ? { endsAt: startsAt + TWO_HOURS }
                  : {}),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-ends">Ends</Label>
          <DateTimePicker
            id="ev-ends"
            value={values.endsAt}
            defaultTime="12:00"
            placeholder="Pick a date"
            minDate={values.startsAt}
            onChange={(endsAt) => patch({ endsAt })}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-capacity">Capacity</Label>
          <Input
            id="ev-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            value={values.capacity ?? ''}
            onChange={(e) =>
              patch({
                capacity: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
              })
            }
            placeholder="No limit"
          />
          <p className="text-muted-foreground text-xs">Total people. Leave empty for no limit.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-party">Max per booking</Label>
          <Input
            id="ev-party"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            value={values.maxPartySize}
            onChange={(e) =>
              patch({ maxPartySize: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
          <p className="text-muted-foreground text-xs">For online bookings. Staff can add more.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-closes">Bookings close (optional)</Label>
        <DateTimePicker
          id="ev-closes"
          value={values.bookingsCloseAt}
          placeholder="When it starts"
          onChange={(bookingsCloseAt) => patch({ bookingsCloseAt })}
        />
        <p className="text-muted-foreground text-xs">
          Online bookings close when it starts, unless set.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-summary">Summary</Label>
        <Textarea
          id="ev-summary"
          rows={2}
          maxLength={200}
          value={values.summary}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="A sentence about the day"
        />
        <p className="text-muted-foreground text-xs">Shown in lists and in guest emails.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-description">Description</Label>
        <Textarea
          id="ev-description"
          rows={6}
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What happens, what to bring, parking"
        />
        <p className="text-muted-foreground text-xs">Markdown.</p>
      </div>

      <ImageField
        id="ev-photo"
        label="Photo"
        mediaId={values.heroMediaId}
        onChange={(heroMediaId) => patch({ heroMediaId })}
      />

      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div className="space-y-0.5">
          <Label htmlFor="ev-published">Published</Label>
          <p className="text-muted-foreground text-xs">
            Ready for the website once it shows events.
          </p>
        </div>
        <Switch
          id="ev-published"
          checked={values.status === 'published'}
          onCheckedChange={(checked) => patch({ status: checked ? 'published' : 'draft' })}
        />
      </div>

      {actions(
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : event ? (
            'Save'
          ) : (
            'Create event'
          )}
        </Button>,
        event && (
          <div className="flex gap-1">
            <CancelEvent event={event} />
            <DeleteEvent event={event} onRemoved={() => onSaved(null)} />
          </div>
        )
      )}
    </form>
  );
}

/** A cancelled event cannot change, so it is shown, not edited. */
function CancelledEvent({
  event,
  actions,
  onRemoved,
}: {
  event: EventRow;
  actions: FormActions;
  onRemoved: () => void;
}) {
  const zone = useTimeZone();
  return (
    <div className="space-y-4">
      <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2.5 text-sm">
        This event is cancelled. Its bookings are kept for the record.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">When</dt>
        <dd>{formatDateTime(event.startsAt, zone)}</dd>
        <dt className="text-muted-foreground">Where</dt>
        <dd>{event.venue || event.locationName || 'Not set'}</dd>
        <dt className="text-muted-foreground">Bookings</dt>
        <dd className="tabular-nums">{event.bookings}</dd>
      </dl>
      {actions(null, <DeleteEvent event={event} onRemoved={onRemoved} />)}
    </div>
  );
}

function CancelEvent({ event }: { event: EventRow }) {
  const { run, pending } = useAction();
  const n = event.bookings;
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-muted-foreground"
          />
        }
      >
        Cancel event
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {n === 0
              ? 'Nobody has booked yet.'
              : `${n} ${n === 1 ? 'booking stays' : 'bookings stay'} on its guest list, and HubSpot tells the guests once it is connected.`}{' '}
            The event stays in the list, marked cancelled. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              run(() => cancelEvent({ data: { id: event.id } }), {
                success: {
                  title: 'Event cancelled',
                  description: 'It stays in the list, marked cancelled.',
                },
                error: 'Could not cancel the event',
              })
            }
          >
            Cancel event
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteEvent({ event, onRemoved }: { event: EventRow; onRemoved: () => void }) {
  const { run, pending } = useAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its guest list is deleted too. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              run(
                async () => {
                  await deleteEvent({ data: { id: event.id } });
                  return true;
                },
                {
                  success: removedNotice(1, ['event', 'events']),
                  error: 'Could not delete the event',
                }
              ).then((removed) => removed && onRemoved())
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
