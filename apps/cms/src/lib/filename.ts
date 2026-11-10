// Renaming a file in the Media library. Only the label changes: files are
// served by id, so nothing that uses one breaks. The extension always stays
// the one it was uploaded with, so a name never claims a different type.

const MAX_NAME = 120;

export function splitFilename(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { base: filename, ext: '' };
  return { base: filename.slice(0, dot), ext: filename.slice(dot) };
}

/** The new full name: the typed name, tidied, with the original extension. */
export function renamedFilename(original: string, typed: string): string {
  const base = typed
    // Slashes would read as folders; control characters are invisible.
    .replace(/[/\\\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  if (!base) throw new Error('Give the file a name.');
  return `${base}${splitFilename(original).ext}`;
}
