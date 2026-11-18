// The library's search and filters as they were left, so "‹ Media" on a file's page returns to the
// same view. Kept in memory for the visit (a reload starts the library fresh, as it should).

export type MediaLibrarySearch = {
  q?: string;
  sort?: string;
  types?: ('images' | 'documents')[];
  tags?: string[];
  exts?: string[];
  /** How many files were loaded, so the same ones are back. */
  show?: number;
};

let last: MediaLibrarySearch = {};

export const rememberMediaSearch = (search: MediaLibrarySearch) => {
  last = {
    q: search.q,
    sort: search.sort,
    types: search.types,
    tags: search.tags,
    exts: search.exts,
    show: search.show,
  };
};

export const recallMediaSearch = (): MediaLibrarySearch => last;

// Which way the person just moved between files, so the next file's page arrives from that side:
// 1 for the next file (older), -1 for the previous. Read once by the page that opens.
let direction: 1 | -1 | 0 = 0;
export const setMediaDirection = (next: 1 | -1) => {
  direction = next;
};
export const takeMediaDirection = () => {
  const taken = direction;
  direction = 0;
  return taken;
};
