// Redirect matching, shared by the website (which serves redirects) and the
// CMS (which checks new ones for loops and chains before saving).

export const redirectStatusCodes = [301, 302, 410] as const;
export type RedirectStatusCode = (typeof redirectStatusCodes)[number];

export type RedirectRule = {
  id: string;
  /** Old path. A trailing `*` matches everything under it, e.g. `/blog/*`. */
  fromPath: string;
  /** Destination path or URL. A `*` receives what the old path's `*` matched. Empty for 410. */
  toPath: string;
  statusCode: RedirectStatusCode;
  /** Carry the request's query string over to the destination. */
  keepQuery: boolean;
};

export type RedirectMatch = {
  rule: RedirectRule;
  /** Where to send the visitor, or `null` for a 410 (gone). */
  location: string | null;
};

/** Lowercase, without a trailing slash (except the root path). */
export function normalizePath(pathname: string): string {
  const lower = pathname.toLowerCase();
  return lower.length > 1 && lower.endsWith('/') ? lower.slice(0, -1) : lower;
}

export const isWildcard = (fromPath: string) => fromPath.endsWith('*');

/** The path part of a destination, for comparing against request paths. Null for external URLs. */
function localPath(to: string): string | null {
  if (!to.startsWith('/')) return null;
  return normalizePath(to.split(/[?#]/, 1)[0]!);
}

/** Inserts the request's query string before any hash fragment on the target. */
export function withSearch(to: string, search: string): string {
  if (!search || search === '?') return to;

  const hashIndex = to.indexOf('#');
  const base = hashIndex === -1 ? to : to.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : to.slice(hashIndex);
  const joined = base.includes('?') ? `${base}&${search.slice(1)}` : `${base}${search}`;

  return `${joined}${hash}`;
}

/**
 * Finds the rule for a request path: exact rules first, then wildcards, longest
 * prefix first. A rule that would send a path to itself is skipped, so
 * `/thank-you-*` leaves `/thank-you-contact` alone.
 */
export function matchRedirect(rules: RedirectRule[], pathname: string): RedirectMatch | null {
  const path = normalizePath(pathname);

  const exact = rules.find((r) => !isWildcard(r.fromPath) && normalizePath(r.fromPath) === path);
  if (exact) {
    const match = toMatch(exact, '');
    if (match.location === null || localPath(match.location) !== path) return match;
  }

  const wildcards = rules
    .filter((r) => isWildcard(r.fromPath))
    .sort((a, b) => b.fromPath.length - a.fromPath.length);
  for (const rule of wildcards) {
    const prefix = rule.fromPath.slice(0, -1).toLowerCase();
    if (!path.startsWith(prefix)) continue;
    const match = toMatch(rule, pathname.slice(prefix.length).replace(/\/$/, ''));
    if (match.location === null || localPath(match.location) !== path) return match;
  }

  return null;
}

function toMatch(rule: RedirectRule, rest: string): RedirectMatch {
  if (rule.statusCode === 410) return { rule, location: null };
  return { rule, location: rule.toPath.replace('*', rest) };
}

/**
 * Resolves a request to a redirect, or `null`. `search` comes straight off the
 * request URL (`?a=1`, or `''`).
 */
export function resolveRedirect(
  rules: RedirectRule[],
  pathname: string,
  search: string
): RedirectMatch | null {
  const match = matchRedirect(rules, pathname);
  if (!match?.location || !match.rule.keepQuery) return match;
  return { ...match, location: withSearch(match.location, search) };
}

export type RedirectTrace = {
  /** The paths a visitor passes through after the first hop, in order. */
  hops: string[];
  /** True when following the redirects comes back to the starting path. */
  loop: boolean;
  /** True when the trail ends at a path marked as gone (410). */
  gone: boolean;
};

/**
 * Follows a proposed redirect through the existing rules, to spot loops
 * (A → B → A) and chains (A → B → C, which should point at C directly).
 */
export function traceRedirect(rules: RedirectRule[], candidate: RedirectRule): RedirectTrace {
  const others = rules.filter((r) => r.id !== candidate.id);
  const start = isWildcard(candidate.fromPath) ? null : normalizePath(candidate.fromPath);
  const hops: string[] = [];
  const seen = new Set(start ? [start] : []);

  // A wildcard destination is traced with a sample path in place of its *.
  let next =
    candidate.statusCode === 410 ? null : localPath(candidate.toPath.replace('*', 'example'));
  while (next) {
    const match = matchRedirect([candidate, ...others], next);
    if (!match) break;
    if (match.rule.id === candidate.id) return { hops, loop: true, gone: false };
    if (match.location === null) return { hops, loop: false, gone: true };
    hops.push(match.location);
    const following = localPath(match.location);
    if (following && seen.has(following)) return { hops, loop: true, gone: false };
    if (following) seen.add(following);
    next = following;
  }
  return { hops, loop: false, gone: false };
}

const DESTINATION = /^(\/\S*|https?:\/\/\S+)$/;

/**
 * Checks one redirect's paths and type, the same rules the CMS form applies.
 * Returns what is wrong, or null when it is fine.
 */
export function checkRedirect(fromPath: string, toPath: string, statusCode: number): string | null {
  if (!fromPath.startsWith('/')) return 'The old path must start with a slash.';
  if (/\s/.test(fromPath)) return 'The old path cannot contain spaces.';
  if (fromPath.slice(0, -1).includes('*')) return 'A * can only end the old path.';
  if (!(redirectStatusCodes as readonly number[]).includes(statusCode)) {
    return 'The type must be 301, 302 or 410.';
  }
  if (statusCode === 410) return null;
  if (!toPath) return 'The destination is empty.';
  if (!DESTINATION.test(toPath)) return 'The destination must be a path or a full URL.';
  if (toPath.includes('*') && !isWildcard(fromPath)) {
    return 'A * in the destination needs a * at the end of the old path.';
  }
  return null;
}
