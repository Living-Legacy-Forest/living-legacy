// The orders the lists that sort on the server can be put in. Shared so the page offers exactly
// what the query accepts. The first option of each is the list's own order.

export const postSorts = [
  { value: 'default', label: 'Latest activity' },
  { value: 'updated', label: 'Recently edited' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-az', label: 'Title, A to Z' },
  { value: 'title-za', label: 'Title, Z to A' },
] as const;
export type PostSort = (typeof postSorts)[number]['value'];

export const mediaSorts = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-az', label: 'Name, A to Z' },
  { value: 'name-za', label: 'Name, Z to A' },
  { value: 'largest', label: 'Largest' },
  { value: 'smallest', label: 'Smallest' },
] as const;
export type MediaSort = (typeof mediaSorts)[number]['value'];
