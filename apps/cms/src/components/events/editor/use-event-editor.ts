import type { SeriesScope } from '@ll/content';
import { useBlocker } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { reportInvalid } from '@/lib/form-validation';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { type EventRow, type LocationOption, saveEvent } from '@/server/events';
import type { EventTimes, SessionTime } from '../event-dates-field';
import { type RepeatValue, noRepeat } from '../repeat-field';
import {
  type EventValues,
  expandEventTimes,
  initialEventValues,
  isEventDirty,
  rezoneValues,
  savedValues,
  timesProblem,
} from './event-values';

/**
 * State and actions for the event page: the form's values, saving (which asks
 * about a repeating event's other dates first), and the warning before leaving
 * with changes. Remount the page (change its `key`) to reload from the server.
 */
export function useEventEditor({
  event,
  locations,
  onSaved,
}: {
  event: EventRow | null;
  locations: LocationOption[];
  onSaved: (id: string) => void;
}) {
  const siteZone = useTimeZone();
  // What the server has: leaving with anything else loses it. A save replaces it.
  const [saved, setSaved] = useState(() => initialEventValues(event, siteZone));
  const [values, setValues] = useState<EventValues>(saved);
  const [sessions, setSessions] = useState<SessionTime[]>([]);
  // Picking a location sets the zone, until someone chooses one themselves.
  const [zoneChosen, setZoneChosen] = useState(Boolean(event));
  const [repeat, setRepeat] = useState<RepeatValue>(noRepeat);
  const [askScope, setAskScopeOpen] = useState(false);
  const { run, pending } = useAction();
  // Publish saves with these on top of the form, whichever way the question about dates goes.
  const overrides = useRef<Partial<EventValues>>({});

  const zone = values.timeZone;
  const times: EventTimes | null =
    values.startsAt !== null && values.endsAt !== null
      ? { startsAt: values.startsAt, endsAt: values.endsAt }
      : null;
  const patch = (next: Partial<EventValues>) => setValues((v) => ({ ...v, ...next }));
  const rezone = (next: string) => setValues((v) => rezoneValues(v, next));

  const dirty = isEventDirty(values, saved, { sessions, repeat });
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const skipBlockRef = useRef(false);
  const blocker = useBlocker({
    // Switching to Guests or Dashboard only changes the address's search, and the form
    // stays mounted behind them, so nothing is lost; another date or page does lose it.
    shouldBlockFn: ({ current, next }) =>
      dirtyRef.current && !skipBlockRef.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirtyRef.current && !skipBlockRef.current,
    withResolver: true,
  });
  /** For the navigation that follows a save, a cancel or a delete: nothing is lost by it. */
  const skipBlock = () => {
    skipBlockRef.current = true;
  };

  const allTimes = (first: EventTimes) => expandEventTimes(first, repeat, sessions, zone);

  async function save(scope: SeriesScope) {
    if (!times) return;
    const moreDates = event ? [] : allTimes(times).slice(1);
    const extra = overrides.current;
    const data = { ...values, ...extra, ...times, id: event?.id, moreDates, scope };
    const result = await run(() => saveEvent({ data }), {
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
              : data.status === 'published'
                ? 'Staff can add guests, and it is ready for the website.'
                : 'It is a draft. Staff can still add guests.',
      }),
      error: 'Could not save the event',
    });
    overrides.current = {};
    if (!result) return;
    if (event) {
      // The page stays as it is, with its scroll, cursor and panels. Anything typed
      // while saving is still a change.
      setValues((v) => ({ ...v, ...extra }));
      setSaved(savedValues({ ...values, ...times }, extra));
    } else {
      // A new event moves to its own page, which loses nothing.
      skipBlock();
    }
    onSaved(result.id);
  }

  /** Checks the form, then saves, or asks which dates to change first. */
  function attempt(form: HTMLFormElement, extra: Partial<EventValues> = {}) {
    if (!reportInvalid(form)) return;
    const problem = timesProblem({ times, sessions, zone, repeat, isNew: !event });
    if (problem) {
      notify.error('Check the event', problem);
      document.getElementById('ev-date')?.scrollIntoView({ block: 'center' });
      return;
    }
    overrides.current = extra;
    // A date in a series asks whether the change is for it alone.
    if (event?.seriesId) setAskScopeOpen(true);
    else void save('one');
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    attempt(e.currentTarget);
  };
  /** Publishes now, replacing any time it was set to go live. */
  const publish = (form: HTMLFormElement) =>
    attempt(form, { status: 'published', publishAt: null });

  return {
    values,
    patch,
    zone,
    rezone,
    setZoneChosen,
    zoneChosen,
    locations,
    sessions,
    setSessions,
    repeat,
    setRepeat,
    times,
    dirty,
    pending,
    submit,
    publish,
    askScope,
    setAskScope: setAskScopeOpen,
    /** The answer to "which dates should change?". */
    chooseScope: (scope: SeriesScope) => {
      setAskScopeOpen(false);
      void save(scope);
    },
    allTimes,
    skipBlock,
    blocker,
    /** What Preview shows: the form as it is, unsaved changes included. */
    previewDraft: () => ({
      ...values,
      id: event?.id ?? null,
      seriesId: event?.seriesId ?? null,
      summary: values.summary ?? '',
      venue: values.venue ?? '',
      booked: event?.booked ?? 0,
      moreDates: !event && times ? allTimes(times).slice(1) : [],
    }),
  };
}

export type EventEditorState = ReturnType<typeof useEventEditor>;
