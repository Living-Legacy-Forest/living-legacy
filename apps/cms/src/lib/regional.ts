import type { DateFormat, TimeFormat } from '@ll/content';

// How the CMS writes dates and times (Settings, General). The formatting helpers are called from
// dozens of places with only a time zone, so they read the choice from here rather than every
// caller passing it down. The root layout sets it from the loaded settings before anything
// renders, on the server and in the browser alike, so the two always write the same text.

export type Regional = { dateFormat: DateFormat; timeFormat: TimeFormat };

let current: Regional = { dateFormat: 'short', timeFormat: '12' };

export function setRegional(next: Regional) {
  current = next;
}

export function getRegional(): Regional {
  return current;
}
