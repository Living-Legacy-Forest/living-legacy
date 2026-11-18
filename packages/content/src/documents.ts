// Documents in the Media library: what can be uploaded, and how a file is checked to really be
// one. The browser's reported type is only a hint (many systems leave it empty for Office
// files), so the type comes from the name's extension and the file's first bytes must agree.

/** How a format starts: PDF text, a ZIP (docx, xlsx, pptx) or an old Office compound file. */
type Signature = 'pdf' | 'zip' | 'ole';

export interface DocumentType {
  mime: string;
  extension: string;
  /** What to call it in the library. */
  label: string;
  signature: Signature;
}

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  { mime: 'application/pdf', extension: 'pdf', label: 'PDF', signature: 'pdf' },
  { mime: 'application/msword', extension: 'doc', label: 'Word', signature: 'ole' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    label: 'Word',
    signature: 'zip',
  },
  { mime: 'application/vnd.ms-excel', extension: 'xls', label: 'Excel', signature: 'ole' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    label: 'Excel',
    signature: 'zip',
  },
  {
    mime: 'application/vnd.ms-powerpoint',
    extension: 'ppt',
    label: 'PowerPoint',
    signature: 'ole',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
    label: 'PowerPoint',
    signature: 'zip',
  },
];

/** Documents larger than this are refused. Images have a smaller limit of their own. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** For a file input's `accept`. */
export const DOCUMENT_ACCEPT = DOCUMENT_TYPES.flatMap((t) => [t.mime, `.${t.extension}`]).join(',');

/** "PDF, Word, Excel or PowerPoint", for messages. */
export const DOCUMENT_NOTE = 'PDF, Word, Excel or PowerPoint';

const byMime = new Map(DOCUMENT_TYPES.map((t) => [t.mime, t]));
const byExtension = new Map(DOCUMENT_TYPES.map((t) => [t.extension, t]));

export const isDocumentMime = (mime: string): boolean => byMime.has(mime);

export const documentType = (mime: string): DocumentType | undefined => byMime.get(mime);

const extensionOf = (filename: string) => /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();

/**
 * The document type for an upload, from its name and the type the browser reported. The name
 * decides when the browser said nothing useful (empty, or a generic binary type); otherwise the
 * two must agree, so a renamed file is not taken for something else.
 */
export function documentTypeFor(filename: string, reportedMime: string): DocumentType | null {
  const fromName = byExtension.get(extensionOf(filename) ?? '');
  if (!fromName) return null;
  const generic = !reportedMime || reportedMime === 'application/octet-stream';
  return generic || reportedMime === fromName.mime ? fromName : null;
}

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

/** Whether the file's first bytes are those of its claimed format. */
export function matchesSignature(bytes: Uint8Array, type: DocumentType): boolean {
  switch (type.signature) {
    case 'pdf':
      // %PDF-, which some writers put after a short run of junk, but never far in.
      return new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-');
    case 'zip':
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case 'ole':
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
}

/**
 * The Content-Disposition for serving a file: a PDF opens in the browser, and Office files
 * download under their own name. The name is sent both as plain ASCII and as UTF-8.
 */
export function contentDisposition(filename: string, mime: string): string {
  const kind = mime === 'application/pdf' ? 'inline' : 'attachment';
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )}`;
}
