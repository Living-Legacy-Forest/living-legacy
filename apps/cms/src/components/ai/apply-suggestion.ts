/**
 * What goes into the field when a suggestion arrives: the suggestion, unless the editor changed the
 * field while it was being written, in which case nothing, so their typing is never overwritten.
 * `same` says when two values are the same (strings by default; lists need their own).
 */
export function applySuggestion<T>(
  { before, current, suggestion }: { before: T; current: T; suggestion: T },
  same: (a: T, b: T) => boolean = Object.is
): T | null {
  return same(before, current) ? suggestion : null;
}
