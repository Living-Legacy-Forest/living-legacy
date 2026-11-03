import { getRouteApi } from '@tanstack/react-router';

const rootRoute = getRouteApi('__root__');

/** The organisation's configured time zone (Settings → Language & appearance). */
export function useTimeZone(): string {
  return rootRoute.useLoaderData().timeZone;
}
