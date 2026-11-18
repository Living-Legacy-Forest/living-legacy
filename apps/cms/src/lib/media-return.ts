// The library's search and filters as they were left, so "‹ Media" on a file's page returns to the
// same view. Kept in memory for the visit (a reload starts the library fresh, as it should).

export type MediaLibrarySearch = {
  q?: string;
  sort?: string;
  type?: 'images' | 'documents';
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
    type: search.type,
    tags: search.tags,
    exts: search.exts,
    show: search.show,
  };
};

export const recallMediaSearch = (): MediaLibrarySearch => last;
