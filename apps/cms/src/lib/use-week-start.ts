import { getRouteApi } from '@tanstack/react-router';

const rootRoute = getRouteApi('__root__');

/** The day weeks start on in calendars and date pickers (Settings → General): 1 Monday, 0 Sunday. */
export function useWeekStart(): 0 | 1 {
  return rootRoute.useLoaderData().weekStartsOn;
}
