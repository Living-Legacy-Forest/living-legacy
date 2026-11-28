import type { AiGroup } from '@ll/content';
import { useRouteContext } from '@tanstack/react-router';

/**
 * Whether the Suggest buttons show: the assistant is set up on the server and this person can
 * edit. With a `group`, also that kind of suggestion has to be switched on in Settings.
 */
export function useCanSuggest(group?: AiGroup): boolean {
  const { ai, aiGroups } = useRouteContext({ from: '/_app' });
  return ai && (!group || aiGroups[group]);
}
