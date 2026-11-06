import {
  EVENT_PHOTO_LIMIT,
  type EventInput,
  type SeriesScope,
  fromZoned,
  sameClockOn,
  slugify,
  stateTimeZone,
  timeZones,
  toZoned,
} from '@ll/content';
import { useState } from 'react';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormStep, FormSteps, TOUCH_FIELDS, useFormSteps } from '@/components/form-steps';
import { RichTextField } from '@/components/rich-text-field';
import {
  EventDatesField,
  type EventTimes,
  type SessionTime,
  sessionTimes,
} from './event-dates-field';
import { RepeatField, type RepeatValue, noRepeat, seriesDates } from './repeat-field';
import { Trash2Icon } from '@/components/icons';
import { ImageGalleryField } from '@/components/media/image-gallery-field';
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
import { formatDateTime, zoneName } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { notify, removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  type EventRow,
  type LocationOption,
  cancelEvent,
  deleteEvent,
  saveEvent,
} from '@/server/events';

/** The form's buttons, laid out for the pane or the dialog; `start` holds cancel and delete. */
export type FormActions = (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode;

type Values = Omit<EventInput, 'id' | 'startsAt' | 'endsAt' | 'moreDates' | 'scope'> & {
  startsAt: number | null;
  endsAt: number | null;
};

const NO_LOCATION = 'none';

/** "Perth (AWST)": the zone's city and its abbreviation now. */
const zoneItems = timeZones.map((value) => ({
  value,
  label: `${value.split('/')[1]?.replace('_', ' ')} (${zoneName(value)})`,
}));

const STEPS = ['Details', 'Date & time', 'Places'] as const;
/** The last step's check of what is about to be created. */
function NewEventSummary({
  title,
  where,
  times,
  dates,
  zone,
  sessions,
}: {
  title: string;
  where: string;
  times: { startsAt: number; endsAt: number } | null;
  dates: number;
  zone: string;
  sessions: boolean;
}) {
  return (
    <dl className="bg-muted/50 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg px-3 py-2.5 text-sm">
      <dt className="text-muted-foreground">Event</dt>
      <dd className="min-w-0 truncate">{title}</dd>
      <dt className="text-muted-foreground">Where</dt>
      <dd className="min-w-0 truncate">{where || 'Not set'}</dd>
      <dt className="text-muted-foreground">{dates > 1 ? 'First date' : 'When'}</dt>
      <dd>
        {times
          ? `${formatDateTime(times.startsAt, zone)} ${zoneName(zone, times.startsAt)}`
          : 'Not set'}
      </dd>
      {dates > 1 && (
        <>
          <dt className="text-muted-foreground">{sessions ? 'Sessions' : 'Dates'}</dt>
          <dd>{dates}, each with its own guest list</dd>
        </>
      )}
    </dl>
  );
}

function initialValues(event: EventRow | null, siteZone: string): Values {
  if (!event) {
    return {
      timeZone: siteZone as Values['timeZone'],
      title: '',
      slug: '',
      locationId: null,
      venue: '',
      startsAt: null,
      endsAt: null,
      summary: '',
      description: null,
      heroMediaId: null,
      galleryMediaIds: [],
      capacity: null,
      maxPartySize: 6,
      bookingsCloseAt: null,
      status: 'draft',
    };
  }
  return {
    timeZone: event.timeZone as Values['timeZone'],
    title: event.title,
    slug: event.slug,
    locationId: event.locationId,
    venue: event.venue,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    summary: event.summary,
    description: event.description,
    heroMediaId: event.heroMediaId,
    galleryMediaIds: event.galleryMediaIds,
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
  const siteZone = useTimeZone();
  const [values, setValues] = useState<Values>(() => initialValues(event, siteZone));
  const [sessions, setSessions] = useState<SessionTime[]>([]);
  // Picking a location sets the zone, until someone chooses one themselves.
  const [zoneChosen, setZoneChosen] = useState(Boolean(event));
  const [repeat, setRepeat] = useState<RepeatValue>(noRepeat);
  const [askScope, setAskScope] = useState(false);
  // Moving on from Date & time checks the times, which are not plain fields.
  const steps = useFormSteps({
    count: STEPS.length,
    canGoForward: (from) => from !== 1 || timesReady(),
  });
  const { step } = steps;
  const zone = values.timeZone;
  const patch = (next: Partial<Values>) => setValues((v) => ({ ...v, ...next }));
  /** A new zone keeps the clock times (10:00 stays 10:00), not the instants. */
  const rezone = (next: string) =>
    setValues((v) => {
      const move = (ms: number | null) =>
        ms === null ? null : fromZoned(toZoned(ms, v.timeZone), next);
      return {
        ...v,
        timeZone: next as Values['timeZone'],
        startsAt: move(v.startsAt),
        endsAt: move(v.endsAt),
        bookingsCloseAt: move(v.bookingsCloseAt),
      };
    });
  const { run, pending } = useAction();
  const location = locations.find((l) => l.id === values.locationId);
  const locationItems = [
    { value: NO_LOCATION, label: 'No location' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  if (event?.status === 'cancelled') {
    return <CancelledEvent event={event} actions={actions} onRemoved={() => onSaved(null)} />;
  }

  const times =
    values.startsAt !== null && values.endsAt !== null
      ? { startsAt: values.startsAt, endsAt: values.endsAt }
      : null;

  /** Every event a new one makes: each date of its series, at each of its times. */
  function allTimes(first: EventTimes): EventTimes[] {
    const dates =
      repeat.repeat !== 'none'
        ? seriesDates(first, repeat, zone).filter((d) => !d.skipped)
        : [{ ...first }];
    const extra = sessions
      .map((x) => sessionTimes(first.startsAt, x, zone))
      .filter((x): x is EventTimes => x !== null);
    return dates.flatMap((d) => [
      { startsAt: d.startsAt, endsAt: d.endsAt },
      ...extra.map((x) => sameClockOn(d.startsAt, x, zone)),
    ]);
  }

  async function save(scope: SeriesScope) {
    if (!times) return;
    const moreDates = event ? [] : allTimes(times).slice(1);
    const result = await run(
      () => saveEvent({ data: { ...values, ...times, id: event?.id, moreDates, scope } }),
      {
        success: (r) => ({
          title: event
            ? 'Event saved'
            : r.dates > 1
              ? `${r.dates} ${sessions.length ? 'sessions' : 'dates'} created`
              : 'Event created',
          description:
            event && r.dates > 1
              ? `The change was made on ${r.dates} dates.`
              : r.dates > 1
                ? `Each ${sessions.length ? 'session' : 'date'} has its own guest list. Staff can add guests to any of them.`
                : values.status === 'published'
                  ? 'Staff can add guests, and it is ready for the website.'
                  : 'It is a draft. Staff can still add guests.',
        }),
        error: 'Could not save the event',
      }
    );
    if (result) onSaved(result.id);
  }

  /** Checks the times (and how a new series ends); says what is wrong, or returns true. */
  function timesReady() {
    if (!times) {
      notify.error('Check the event', 'Pick its date and times.');
      return false;
    }
    if (times.endsAt <= times.startsAt) {
      notify.error('Check the event', 'It must end after it starts.');
      return false;
    }
    if (times && sessions.some((x) => !sessionTimes(times.startsAt, x, zone))) {
      notify.error(
        'Check the event',
        'Each extra time needs a start and a later end, like 2:00 pm to 4:00 pm.'
      );
      return false;
    }
    const needsEnd = repeat.repeat !== 'none' && repeat.repeat !== 'custom';
    if (!event && needsEnd && repeat.ends === 'until' && !repeat.until) {
      notify.error('Check the event', 'Pick when it stops repeating.');
      return false;
    }
    return true;
  }

  /** A new event moves on until its last step, then is created; a saved one saves. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    if (!event) {
      if (steps.isLast) void save('one');
      else steps.goTo(step + 1);
      return;
    }
    // Saving from another step: the times are on their own one.
    if (!timesReady()) {
      steps.show(1);
      return;
    }
    // A date in a series asks whether the change is for it alone.
    if (event.seriesId) setAskScope(true);
    else void save('one');
  }

  const details = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Title</Label>
        <Input
          id="ev-title"
          required
          maxLength={120}
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Event name"
          enterKeyHint={event ? 'done' : 'next'}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-slug">Web address</Label>
        <Input
          id="ev-slug"
          maxLength={120}
          value={values.slug}
          onChange={(e) => patch({ slug: e.target.value })}
          placeholder={slugify(values.title) || 'event-name'}
          className="font-mono"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
              if (picked && !zoneChosen) rezone(stateTimeZone(picked.state));
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

      <div className="space-y-1.5">
        <Label htmlFor="ev-summary">Summary</Label>
        <Textarea
          id="ev-summary"
          rows={2}
          maxLength={200}
          value={values.summary}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="A sentence about the event"
        />
        <p className="text-muted-foreground text-xs">Shown in event lists.</p>
      </div>

      <div className="space-y-1.5">
        <Label id="ev-description-label" htmlFor="ev-description">
          Description
        </Label>
        <RichTextField
          id="ev-description"
          labelId="ev-description-label"
          value={values.description}
          onChange={(description) => patch({ description })}
          placeholder="What happens, what to bring, parking"
        />
      </div>

      <ImageGalleryField
        id="ev-photos"
        label="Photos"
        description={`Up to ${EVENT_PHOTO_LIMIT}. The first one is the cover.`}
        max={EVENT_PHOTO_LIMIT}
        mediaIds={[...(values.heroMediaId ? [values.heroMediaId] : []), ...values.galleryMediaIds]}
        onChange={([cover = null, ...rest]) => patch({ heroMediaId: cover, galleryMediaIds: rest })}
      />
    </>
  );
  const when = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="ev-zone">Time zone</Label>
        <Select
          items={zoneItems}
          value={values.timeZone}
          onValueChange={(next) => {
            if (!next) return;
            setZoneChosen(true);
            rezone(next);
          }}
        >
          <SelectTrigger id="ev-zone" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zoneItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Set from the location's state. Dates and times below are in this zone.
        </p>
      </div>

      <EventDatesField
        // A new zone re-reads the times shown.
        key={values.timeZone}
        id="ev-date"
        zone={zone}
        value={{ startsAt: values.startsAt, endsAt: values.endsAt }}
        onChange={(next) => patch(next)}
        sessions={event ? undefined : sessions}
        onSessionsChange={event ? undefined : setSessions}
      />

      {event?.seriesId ? (
        <p className="text-muted-foreground -mt-2 text-xs">
          One date of a repeating event. Saving asks whether to change the upcoming dates too.
        </p>
      ) : (
        !event && <RepeatField zone={zone} first={times} value={repeat} onChange={setRepeat} />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ev-closes">Bookings close (optional)</Label>
        <DateTimePicker
          id="ev-closes"
          zone={zone}
          value={values.bookingsCloseAt}
          placeholder="When it starts"
          onChange={(bookingsCloseAt) => patch({ bookingsCloseAt })}
        />
        <p className="text-muted-foreground text-xs">
          Online bookings close when it starts, unless set.
        </p>
      </div>
    </>
  );
  const places = (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
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

      {/* The label fills the row, so all of it is the target and not just the small switch. */}
      <div className="flex items-center justify-between gap-4 rounded-lg border pr-3">
        <Label
          htmlFor="ev-published"
          className="flex-1 flex-col items-start gap-0.5 self-stretch py-2.5 pl-3 font-medium"
        >
          Published
          <span className="text-muted-foreground text-xs font-normal">
            Ready for the website once it shows events.
          </span>
        </Label>
        <Switch
          id="ev-published"
          checked={values.status === 'published'}
          onCheckedChange={(checked) => patch({ status: checked ? 'published' : 'draft' })}
        />
      </div>
    </>
  );

  const saveButton = (label: string) => (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : (
        label
      )}
    </Button>
  );

  const back = step > 0 && (
    <Button type="button" variant="ghost" size="sm" onClick={() => steps.goTo(step - 1)}>
      Back
    </Button>
  );

  // Both go through the same steps. A saved event can also jump between them and
  // save from any of them, so a small change does not mean walking through it all.
  return (
    <form
      ref={steps.form}
      noValidate
      onSubmit={submit}
      className={cn('scroll-mt-12 space-y-5', TOUCH_FIELDS)}
    >
      <FormSteps labels={STEPS} current={step} onPick={event ? steps.goTo : undefined} />
      <FormStep step={step} forward={steps.forward} className="space-y-5">
        {step === 0 && details}
        {step === 1 && when}
        {step === 2 && (
          <>
            {places}
            {!event && (
              <NewEventSummary
                title={values.title}
                where={values.venue || location?.name || ''}
                times={times}
                dates={times ? allTimes(times).length : 1}
                zone={zone}
                sessions={sessions.length > 0}
              />
            )}
          </>
        )}
      </FormStep>

      {event && (
        <ScopeDialog
          open={askScope}
          onOpenChange={setAskScope}
          title="Which dates should change?"
          description="Save to this date only, or to this date and the upcoming ones. A date you edited on its own keeps its values, unless you changed the same thing here."
          onChoose={(scope) => {
            setAskScope(false);
            void save(scope);
          }}
        />
      )}

      {event
        ? actions(
            <>
              {!steps.isLast && (
                <Button type="button" variant="outline" onClick={() => steps.goTo(step + 1)}>
                  Next
                </Button>
              )}
              {saveButton('Save')}
            </>,
            <div className="flex gap-1">
              {back}
              {steps.isLast && (
                <>
                  <CancelEvent event={event} />
                  <DeleteEvent event={event} onRemoved={() => onSaved(null)} />
                </>
              )}
            </div>
          )
        : actions(
            steps.isLast ? saveButton('Create event') : <Button type="submit">Next</Button>,
            back
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
  const zone = event.timeZone;
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

/** Room for Cancel and both scope buttons on one line. */
const SCOPE_DIALOG = 'data-[size=default]:sm:max-w-lg';

/** The two buttons a repeating event's dialogs end with, or the one for a single event. */
function ScopeActions({
  series,
  label,
  onChoose,
}: {
  series: boolean;
  label: string;
  onChoose: (scope: SeriesScope) => void;
}) {
  if (!series)
    return <AlertDialogAction onClick={() => onChoose('one')}>{label}</AlertDialogAction>;
  return (
    <>
      <AlertDialogAction variant="outline" onClick={() => onChoose('one')}>
        This date only
      </AlertDialogAction>
      <AlertDialogAction onClick={() => onChoose('following')}>
        This and upcoming dates
      </AlertDialogAction>
    </>
  );
}

/** Asks whether a change to a repeating event is for this date or the upcoming ones too. */
function ScopeDialog({
  open,
  onOpenChange,
  title,
  description,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onChoose: (scope: SeriesScope) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={SCOPE_DIALOG}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <ScopeActions series label="Save" onChoose={onChoose} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const datesNote = (n: number) => (n > 1 ? ` on ${n} dates` : '');

function CancelEvent({ event }: { event: EventRow }) {
  const { run, pending } = useAction();
  const n = event.bookings;
  const series = Boolean(event.seriesId);
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
      <AlertDialogContent className={cn(series && SCOPE_DIALOG)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {n === 0
              ? 'Nobody has booked this date yet.'
              : `${n} ${n === 1 ? 'booking stays' : 'bookings stay'} on its guest list, and HubSpot tells the guests once it is connected.`}{' '}
            {series && 'Cancel this date only, or the upcoming dates too. '}
            Cancelled dates stay in the list. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <ScopeActions
            series={series}
            label="Cancel event"
            onChoose={(scope) =>
              run(() => cancelEvent({ data: { id: event.id, scope } }), {
                success: (r) => ({
                  title: `Event cancelled${datesNote(r.dates)}`,
                  description: 'Cancelled dates stay in the list.',
                }),
                error: 'Could not cancel the event',
              })
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteEvent({ event, onRemoved }: { event: EventRow; onRemoved: () => void }) {
  const { run, pending } = useAction();
  const series = Boolean(event.seriesId);
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
      <AlertDialogContent className={cn(series && SCOPE_DIALOG)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            {series && 'Delete this date only, or the upcoming dates too. '}
            Guest lists are deleted with their dates. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <ScopeActions
            series={series}
            label="Delete"
            onChoose={(scope) =>
              run(() => deleteEvent({ data: { id: event.id, scope } }), {
                success: (r) => removedNotice(Math.max(1, r.dates), ['event date', 'event dates']),
                error: 'Could not delete the event',
              }).then((removed) => removed && onRemoved())
            }
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
