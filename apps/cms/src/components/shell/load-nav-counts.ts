import { useEffect } from 'react';
import { mergeNavCounts, resetNavCounts } from '@/lib/nav-counts-store';
import { getNavCounts } from '@/server/nav-counts';

/**
 * Asks the server for the sidebar's numbers once, as the app opens for someone. Nothing asks
 * again; see `nav-counts-store`. A failed ask leaves the badges out, which is harmless.
 */
export function useLoadNavCounts(userId: string) {
  useEffect(() => {
    resetNavCounts();
    getNavCounts().then(mergeNavCounts, () => {});
    return resetNavCounts;
  }, [userId]);
}
