/**
 * Local-dev shortcut for signing in without an inbox. The magic-link sender parks the link it
 * would have emailed here, and the dev sign-in button on the login page reads it back. Nothing in
 * this file is reachable outside `vite dev` on localhost: the callers check `import.meta.env.DEV`
 * (a build replaces it with false, so the code is dropped) and the request's host.
 */
const links = new Map<string, string>();

export function parkDevLoginLink(email: string, url: string) {
  links.set(email, url);
}

export function takeDevLoginLink(email: string): string | undefined {
  const url = links.get(email);
  links.delete(email);
  return url;
}

/** Only the machine running the dev server. */
export function isLocalHost(requestUrl: string): boolean {
  const { hostname } = new URL(requestUrl);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
