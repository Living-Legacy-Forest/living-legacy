import { useEffect, useState } from 'react';
import { getPostViews } from '@/server/post-views';

/**
 * Page views over the last 30 days for the posts on this page, by slug, once PostHog has
 * answered. Stays empty when the CMS has no PostHog key or the request fails, so a row simply
 * shows no chart rather than an invented one.
 */
export function usePostViews(slugs: string[]) {
  const key = slugs.join(',');
  const [state, setState] = useState<{ key: string; views: Record<string, number[]> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let active = true;
    getPostViews({ data: { slugs: key.split(',') } }).then(
      (result) => active && result && setState({ key, views: result.views }),
      // PostHog being down is not worth interrupting the list for.
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [key]);

  // Views kept from the previous page would sit under the wrong rows, so only this page's count.
  return state?.key === key ? state.views : null;
}
