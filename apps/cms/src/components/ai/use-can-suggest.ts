import { useRouteContext } from '@tanstack/react-router';

/** Whether the Suggest buttons show: the assistant is set up on the server and this role can edit. */
export function useCanSuggest(): boolean {
  return useRouteContext({ from: '/_app' }).ai;
}
