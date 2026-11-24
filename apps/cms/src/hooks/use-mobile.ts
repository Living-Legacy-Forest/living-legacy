import * as React from 'react';

/**
 * A phone: narrower than 48rem, or a touch screen under 30rem tall (a phone on its side). The
 * same condition as `max-md:` in styles.css, so the layout and the code never disagree.
 */
export const PHONE_QUERY = '(width < 48rem), (hover: none) and (height < 30rem)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
