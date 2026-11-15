import {
  EVENT_PHOTO_LIMIT,
  type SeriesScope,
  slugify,
  stateTimeZone,
  timeZones,
} from '@ll/content';
import { useState } from 'react';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormBlock, FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { FormStep, FormSteps, TOUCH_FIELDS, useFormSteps } from '@/components/form-steps';
import { RichTextField } from '@/components/rich-text-field';
import { EventDatesField, type EventTimes, type SessionTime } from './event-dates-field';
import {
  type EventValues as Values,
  expandEventTimes,
  initialEventValues,
  rezoneValues,
  timesProblem,
} from './editor/event-values';
import { RepeatField, type RepeatValue, noRepeat } from './repeat-field';
import {
  CancelEventDialog,
  CancelledEventSummary,
  DeleteEventButton,
  PreviewButton,
  ScopeDialog,
} from './editor/event-actions';
import { ImageGalleryField } from '@/components/media/image-gallery-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/ui/number-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, zoneName } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { type EventRow, type LocationOption, saveEvent } from '@/server/events';

/** The form's buttons, laid out for the pane or the dialog; `start` holds cancel and delete. */
export type FormActions = (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode;

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

/** One part of a saved event's form, under its own heading unless only `label` is given. */
function EditSection({
  title,
  label = title,
  children,
}: {
  title?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="space-y-5 [--form-gap:1.25rem] not-first:border-t not-first:pt-8 max-md:space-y-7 max-md:not-first:border-0 max-md:not-first:pt-0"
    >
      {title && (
        <h2 className="text-base font-semibold max-md:px-4 max-md:text-[1.0625rem]">{title}</h2>
      )}
      {children}
    </section>
  );
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
  const [values, setValues] = useState<Values>(() => initialEventValues(event, siteZone));
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
  const rezone = (next: string) => setValues((v) => rezoneValues(v, next));
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
  const allTimes = (first: EventTimes) => expandEventTimes(first, repeat, sessions, zone);

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
    const problem = timesProblem({ times, sessions, zone, repeat, isNew: !event });
    if (problem) notify.error('Check the event', problem);
    return problem === null;
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
    // The whole form is on show when editing, so point at the times.
    if (!timesReady()) {
      document.getElementById('ev-date')?.scrollIntoView({ block: 'center' });
      return;
    }
    // A date in a series asks whether the change is for it alone.
    if (event.seriesId) setAskScope(true);
    else void save('one');
  }

  const details = (
    <>
      <FormSection>
        <FormCell label="Title" htmlFor="ev-title">
          <Input
            id="ev-title"
            required
            maxLength={120}
            value={values.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Event name"
            enterKeyHint={event ? 'done' : 'next'}
          />
        </FormCell>
        <FormCell
          label="Web address"
          htmlFor="ev-slug"
          hint={
            event?.seriesId || repeat.repeat !== 'none'
              ? 'One address for all its dates, used for its page once the website shows events.'
              : 'Used for its page once the website shows events.'
          }
        >
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
        </FormCell>
      </FormSection>

      <FormSection title="Where">
        <FormCell label="Location" htmlFor="ev-location">
          <Select
            items={locationItems}
            value={values.locationId ?? NO_LOCATION}
            onValueChange={(value) => {
              const picked = locations.find((l) => l.id === value);
              // The venue follows the location while it is empty or still the
              // last location's address; one typed by hand is kept.
              const followsLocation = !values.venue || values.venue === location?.address;
              patch({
                locationId: picked ? picked.id : null,
                ...(followsLocation ? { venue: picked?.address ?? '' } : {}),
              });
              if (picked && !zoneChosen) rezone(stateTimeZone(picked.state));
            }}
          >
            <SelectTrigger id="ev-location" className="w-full sm:w-64">
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
        </FormCell>
        <FormCell label="Venue" htmlFor="ev-venue">
          <Input
            id="ev-venue"
            maxLength={300}
            value={values.venue}
            onChange={(e) => patch({ venue: e.target.value })}
            placeholder={location?.address || 'Where to go'}
          />
        </FormCell>
      </FormSection>

      <FormSection>
        <FormCell label="Summary" htmlFor="ev-summary" hint="Shown in event lists.">
          <Textarea
            id="ev-summary"
            rows={2}
            maxLength={200}
            value={values.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="A sentence about the event"
          />
        </FormCell>
      </FormSection>

      <FormBlock label="Description" labelId="ev-description-label" htmlFor="ev-description">
        <RichTextField
          id="ev-description"
          labelId="ev-description-label"
          value={values.description}
          onChange={(description) => patch({ description })}
          placeholder="What happens, what to bring, parking"
        />
      </FormBlock>

      <FormSection>
        <ImageGalleryField
          id="ev-photos"
          label="Photos"
          description={`Up to ${EVENT_PHOTO_LIMIT}. The first one is the cover.`}
          max={EVENT_PHOTO_LIMIT}
          mediaIds={[
            ...(values.heroMediaId ? [values.heroMediaId] : []),
            ...values.galleryMediaIds,
          ]}
          onChange={([cover = null, ...rest]) =>
            patch({ heroMediaId: cover, galleryMediaIds: rest })
          }
        />
      </FormSection>
    </>
  );
  const when = (
    <>
      <FormSection>
        <FormCell
          label="Time zone"
          htmlFor="ev-zone"
          hint="Set from the location's state. Dates and times below are in this zone."
        >
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
        </FormCell>
      </FormSection>

      <FormSection>
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
      </FormSection>

      {event?.seriesId ? (
        <p className="text-muted-foreground -mt-2 text-xs max-md:-mt-5 max-md:px-4 max-md:text-[0.8125rem]">
          One date of a repeating event. Saving asks whether to change the upcoming dates too.
        </p>
      ) : (
        !event && (
          <FormSection>
            <RepeatField zone={zone} first={times} value={repeat} onChange={setRepeat} />
          </FormSection>
        )
      )}

      <FormSection>
        <div className="grid grid-cols-2 gap-3 max-md:contents sm:gap-5">
          <FormCell
            label="Bookings open (optional)"
            htmlFor="ev-opens"
            hint="Online bookings open when it is published, unless set."
          >
            <DateTimePicker
              id="ev-opens"
              zone={zone}
              value={values.bookingsOpenAt}
              placeholder="When published"
              onChange={(bookingsOpenAt) => patch({ bookingsOpenAt })}
            />
          </FormCell>
          <FormCell
            label="Bookings close (optional)"
            htmlFor="ev-closes"
            hint="Online bookings close when it starts, unless set."
          >
            <DateTimePicker
              id="ev-closes"
              zone={zone}
              value={values.bookingsCloseAt}
              placeholder="When it starts"
              onChange={(bookingsCloseAt) => patch({ bookingsCloseAt })}
            />
          </FormCell>
        </div>
      </FormSection>
    </>
  );
  const places = (
    <>
      <FormSection>
        <div className="grid grid-cols-2 gap-3 max-md:contents sm:gap-5">
          <FormCell
            label="Capacity"
            htmlFor="ev-capacity"
            hint="Total people. Leave empty for no limit."
          >
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
          </FormCell>
          <FormCell
            label="Max per booking"
            htmlFor="ev-party"
            hint="For online bookings. Staff can add more."
          >
            <NumberField
              id="ev-party"
              min={1}
              max={50}
              value={values.maxPartySize}
              onValueChange={(maxPartySize) => patch({ maxPartySize })}
            />
          </FormCell>
        </div>
      </FormSection>

      <FormSection>
        <FormSwitchCell
          id="ev-published"
          label="Published"
          description="Ready for the website once it shows events."
          checked={values.status === 'published'}
          // Publishing now replaces any time it was set to go live.
          onCheckedChange={(checked) =>
            patch({ status: checked ? 'published' : 'draft', publishAt: null })
          }
        />
        {values.status === 'draft' && (
          <FormCell
            label="Publish later"
            htmlFor="ev-publish-at"
            hint={
              values.publishAt
                ? `It goes live within five minutes of this time (${zoneName(zone, values.publishAt)}).`
                : 'Leave empty to publish it yourself.'
            }
          >
            <DateTimePicker
              id="ev-publish-at"
              zone={zone}
              value={values.publishAt}
              minDate={Date.now()}
              placeholder="Stay a draft"
              onChange={(publishAt) => patch({ publishAt })}
            />
          </FormCell>
        )}
      </FormSection>
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

  // Shows the form as it is, unsaved changes included; nothing is saved, as a
  // published event changes on the website the moment it is.
  const previewButton = (
    <PreviewButton
      draft={() => ({
        ...values,
        id: event?.id ?? null,
        seriesId: event?.seriesId ?? null,
        summary: values.summary ?? '',
        venue: values.venue ?? '',
        booked: event?.booked ?? 0,
        moreDates: !event && times ? allTimes(times).slice(1) : [],
      })}
    />
  );

  const back = step > 0 && (
    <Button type="button" variant="ghost" size="sm" onClick={() => steps.goTo(step - 1)}>
      Back
    </Button>
  );

  // A new event is made in steps; a saved one shows every section at once, so a
  // small change is one scroll and Save, with no steps to walk through.
  return (
    <form
      ref={steps.form}
      noValidate
      onSubmit={submit}
      className={cn('scroll-mt-12 space-y-5', TOUCH_FIELDS)}
    >
      {event ? (
        <div className="space-y-10 max-md:space-y-8">
          {/* No heading of its own: the Details tab above already names it. */}
          <EditSection label={STEPS[0]}>{details}</EditSection>
          <EditSection title={STEPS[1]}>{when}</EditSection>
          <EditSection title={STEPS[2]}>{places}</EditSection>
        </div>
      ) : (
        <>
          <FormSteps labels={STEPS} current={step} />
          <FormStep
            step={step}
            forward={steps.forward}
            className="space-y-5 [--form-gap:1.25rem] max-md:space-y-7"
          >
            {step === 0 && details}
            {step === 1 && when}
            {step === 2 && (
              <>
                {places}
                <NewEventSummary
                  title={values.title}
                  where={values.venue || location?.name || ''}
                  times={times}
                  dates={times ? allTimes(times).length : 1}
                  zone={zone}
                  sessions={sessions.length > 0}
                />
              </>
            )}
          </FormStep>
        </>
      )}

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
              {previewButton}
              {saveButton('Save')}
            </>,
            <div className="flex gap-1">
              <CancelEvent event={event} />
              <DeleteEventButton event={event} onRemoved={() => onSaved(null)} />
            </div>
          )
        : actions(
            <>
              {previewButton}
              {steps.isLast ? saveButton('Create event') : <Button type="submit">Next</Button>}
            </>,
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
  return (
    <div className="space-y-4">
      <CancelledEventSummary
        event={event}
        zoneLabel={formatDateTime(event.startsAt, event.timeZone)}
      />
      {actions(
        <PreviewButton
          draft={() => ({
            ...event,
            moreDates: [],
          })}
        />,
        <DeleteEventButton event={event} onRemoved={onRemoved} />
      )}
    </div>
  );
}

function CancelEvent({ event }: { event: EventRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Cancel event
      </Button>
      <CancelEventDialog event={event} open={open} onOpenChange={setOpen} />
    </>
  );
}
