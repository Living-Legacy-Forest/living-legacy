import { useEffect, useState } from 'react';

/**
 * True while a page's arrival animation (the `data-revealing` rules in styles.css) may play,
 * then false. Rows and panels that mount later, such as a new page of results, then appear
 * plainly instead of replaying the sequence. Starts true so the server's first paint plays it.
 */
export function useRevealOnce(ms = 1600) {
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setRevealing(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return revealing;
}
