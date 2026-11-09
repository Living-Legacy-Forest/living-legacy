import {
  type ContentScore,
  type ContentTargets,
  type PostInput,
  analysePost,
  guidelinesFromSettings,
} from '@ll/content';
import { useEffect, useMemo, useState } from 'react';

/** `value`, once it has stopped changing for `delay` ms. The first value is used straight away. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** The content score for the editor's values, worked out again half a second after typing stops. */
export function useContentScore(values: PostInput, targets: ContentTargets): ContentScore {
  const settled = useSettled(values, 500);
  return useMemo(
    () => analysePost(settled, guidelinesFromSettings(targets, settled)),
    [settled, targets]
  );
}
