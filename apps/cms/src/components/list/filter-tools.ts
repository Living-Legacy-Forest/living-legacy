import { useCallback, useEffect, useState } from 'react';

/** Whether a row must match every group that has ticks, or only one of them. */
export type MatchMode = 'all' | 'any';

type Fact = string | null | undefined | (string | null | undefined)[];

/**
 * Whether a row passes the filters. `facts` is what the row is, by group key (a list for a row that
 * can be several things, such as the tags on a post). Groups with nothing ticked are ignored; with
 * nothing ticked anywhere every row passes. Within a group the ticks widen.
 */
export function rowPasses(
  match: MatchMode,
  picked: Record<string, string[] | undefined>,
  facts: Record<string, Fact>
) {
  const checks = Object.entries(picked)
    .filter(([, ticked]) => ticked?.length)
    .map(([key, ticked]) => {
      const fact = facts[key];
      const values = Array.isArray(fact) ? fact : [fact];
      return values.some((v) => !!v && ticked!.includes(v));
    });
  if (checks.length === 0) return true;
  return match === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

/** The options of a date group: each one takes in the ones nested inside it. */
export const dateOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past 7 days' },
  { value: 'month', label: 'Past 30 days' },
  { value: 'older', label: 'Older' },
];

const DAY = 86_400_000;

/** Which date options a moment falls under (a moment from today is also in the past week). */
export function dateFacts(moment: number | Date | string | null | undefined, now = Date.now()) {
  if (moment === null || moment === undefined) return [];
  const time = moment instanceof Date ? moment.getTime() : new Date(moment).getTime();
  if (Number.isNaN(time)) return [];
  const age = now - time;
  if (age < 0) return ['upcoming'];
  const facts: string[] = [];
  if (age < DAY) facts.push('today');
  if (age < 7 * DAY) facts.push('week');
  if (age < 30 * DAY) facts.push('month');
  else facts.push('older');
  return facts;
}

/** The options of a group for dates in the future (events, scheduled content). */
export const upcomingOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'month', label: 'Next 30 days' },
  { value: 'later', label: 'Later' },
  { value: 'past', label: 'Past' },
];

/** Which upcoming options a moment falls under. */
export function upcomingFacts(moment: number | Date | string | null | undefined, now = Date.now()) {
  if (moment === null || moment === undefined) return [];
  const time = moment instanceof Date ? moment.getTime() : new Date(moment).getTime();
  if (Number.isNaN(time)) return [];
  const ahead = time - now;
  if (ahead < 0) return ['past'];
  const facts: string[] = [];
  if (ahead < DAY) facts.push('today');
  if (ahead < 7 * DAY) facts.push('week');
  if (ahead < 30 * DAY) facts.push('month');
  else facts.push('later');
  return facts;
}

export type SavedFilter = { name: string; values: Record<string, string[]> };

/** A page's saved filter sets, kept in this browser. */
export function useSavedFilters(pageKey: string | undefined) {
  const storageKey = pageKey ? `ll-saved-filters:${pageKey}` : null;
  const [views, setViews] = useState<SavedFilter[]>([]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setViews(raw ? (JSON.parse(raw) as SavedFilter[]) : []);
    } catch {
      setViews([]);
    }
  }, [storageKey]);
  const write = useCallback(
    (next: SavedFilter[]) => {
      setViews(next);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage is full or blocked: the set still works until the page is closed.
      }
    },
    [storageKey]
  );
  const save = (name: string, values: Record<string, string[]>) =>
    write([...views.filter((v) => v.name !== name), { name, values }]);
  const remove = (name: string) => write(views.filter((v) => v.name !== name));
  return { views, save, remove, enabled: Boolean(storageKey) };
}
