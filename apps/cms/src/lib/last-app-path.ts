// Where "Back to app" goes: the last page outside Settings that was open, kept for the tab.

let last = '/';

export const lastAppPath = () => last;

export function rememberAppPath(path: string) {
  last = path;
}
