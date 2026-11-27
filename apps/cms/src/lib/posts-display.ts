// How a person likes the Posts list laid out, in the Display menu: what to group by, and which
// details each row shows. The rules are here, free of the browser, so they can be tested; the
// cookie that keeps them is in posts-display-cookie.ts.

export const postGroupings = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'category', label: 'Category' },
  { value: 'author', label: 'Author' },
] as const;
export type PostGrouping = (typeof postGroupings)[number]['value'];

/** The details a row can show beside its title. */
export const postProperties = [
  { value: 'thumbnail', label: 'Image' },
  { value: 'category', label: 'Category' },
  { value: 'author', label: 'Author' },
  { value: 'date', label: 'Date' },
  { value: 'views', label: 'Views' },
  { value: 'warnings', label: 'Warnings' },
] as const;
export type PostProperty = (typeof postProperties)[number]['value'];

export type PostsDisplay = {
  grouping: PostGrouping;
  /** The details shown, in the order of `postProperties`. */
  properties: PostProperty[];
};

/** Quiet by default: no image, no grouping. */
export const defaultPostsDisplay: PostsDisplay = {
  grouping: 'none',
  properties: ['category', 'author', 'date', 'views', 'warnings'],
};

const groupings = new Set<string>(postGroupings.map((g) => g.value));
const properties = new Set<string>(postProperties.map((p) => p.value));

/** Whatever is in the cookie, trusted for nothing: anything off the expected shape is dropped. */
export function parsePostsDisplay(raw: string | null | undefined): PostsDisplay {
  if (!raw) return defaultPostsDisplay;
  try {
    const data = JSON.parse(raw) as { grouping?: unknown; properties?: unknown };
    const grouping =
      typeof data.grouping === 'string' && groupings.has(data.grouping)
        ? (data.grouping as PostGrouping)
        : defaultPostsDisplay.grouping;
    const chosen = Array.isArray(data.properties)
      ? new Set(data.properties.filter((p): p is string => typeof p === 'string'))
      : null;
    return {
      grouping,
      properties: chosen
        ? postProperties.map((p) => p.value).filter((p) => chosen.has(p) && properties.has(p))
        : defaultPostsDisplay.properties,
    };
  } catch {
    return defaultPostsDisplay;
  }
}

export function toggleProperty(display: PostsDisplay, property: PostProperty): PostsDisplay {
  const on = display.properties.includes(property);
  const next = on
    ? display.properties.filter((p) => p !== property)
    : [...display.properties, property];
  return {
    ...display,
    properties: postProperties.map((p) => p.value).filter((p) => next.includes(p)),
  };
}

/** The bits of a post that grouping looks at. */
export type Groupable = {
  status: 'draft' | 'published';
  reviewRequestedAt: number | null;
  scheduledAt: number | null;
  deletedAt?: number | null;
  categories: { name: string }[];
  author: string | null;
};

export type PostGroup<T> = { key: string; label: string; rows: T[] };

const STATUS_ORDER = ['Draft', 'In review', 'Scheduled', 'Published', 'Trash'];

/** The group a post is under by status, matching the words on its status badge. */
export function statusGroup(row: Groupable, inTrash: boolean): string {
  if (inTrash) return 'Trash';
  if (row.reviewRequestedAt) return 'In review';
  if (row.status === 'published') return 'Published';
  return row.scheduledAt ? 'Scheduled' : 'Draft';
}

/**
 * The rows in groups, each keeping the order the rows arrived in. Without grouping there is one
 * group with no label, so the list draws no heading. Empty groups are never made.
 */
export function groupPosts<T extends Groupable>(
  rows: T[],
  grouping: PostGrouping,
  inTrash: boolean
): PostGroup<T>[] {
  if (grouping === 'none') return rows.length ? [{ key: 'all', label: '', rows }] : [];

  const labelOf = (row: T) =>
    grouping === 'status'
      ? statusGroup(row, inTrash)
      : grouping === 'category'
        ? (row.categories[0]?.name ?? 'No category')
        : (row.author ?? 'No author');

  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const label = labelOf(row);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  const none = grouping === 'category' ? 'No category' : 'No author';
  const labels = [...groups.keys()].sort((a, b) => {
    if (grouping === 'status') return STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b);
    // Named groups in the reader's order, and "none of them" last.
    if (a === none) return 1;
    if (b === none) return -1;
    return a.localeCompare(b, 'en-AU', { sensitivity: 'base' });
  });
  return labels.map((label) => ({ key: `${grouping}:${label}`, label, rows: groups.get(label)! }));
}
