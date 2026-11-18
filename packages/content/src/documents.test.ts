import { describe, expect, it } from 'vitest';
import {
  contentDisposition,
  documentTypeFor,
  isDocumentMime,
  matchesSignature,
  DOCUMENT_TYPES,
} from './documents';

const bytes = (...values: number[]) => new Uint8Array(values);
const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('documentTypeFor', () => {
  it('takes the type from the name when the browser says nothing useful', () => {
    expect(documentTypeFor('Plan.DOCX', '')?.mime).toBe(docx);
    expect(documentTypeFor('plan.docx', 'application/octet-stream')?.mime).toBe(docx);
  });

  it('accepts a name and type that agree', () => {
    expect(documentTypeFor('guide.pdf', 'application/pdf')?.extension).toBe('pdf');
    expect(documentTypeFor('plan.docx', docx)?.extension).toBe('docx');
  });

  it('refuses a name and type that disagree, and anything not a document', () => {
    expect(documentTypeFor('guide.pdf', docx)).toBeNull();
    expect(documentTypeFor('page.html', 'text/html')).toBeNull();
    expect(documentTypeFor('script.js', '')).toBeNull();
    expect(documentTypeFor('noextension', 'application/pdf')).toBeNull();
  });
});

describe('matchesSignature', () => {
  const type = (extension: string) => DOCUMENT_TYPES.find((t) => t.extension === extension)!;

  it('checks the first bytes against the format', () => {
    expect(matchesSignature(new TextEncoder().encode('%PDF-1.7\n'), type('pdf'))).toBe(true);
    expect(matchesSignature(bytes(0x50, 0x4b, 0x03, 0x04, 0), type('docx'))).toBe(true);
    expect(
      matchesSignature(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), type('doc'))
    ).toBe(true);
  });

  it('refuses a file that is not what its name says', () => {
    expect(matchesSignature(new TextEncoder().encode('<html>'), type('pdf'))).toBe(false);
    expect(matchesSignature(new TextEncoder().encode('<html>'), type('docx'))).toBe(false);
    expect(matchesSignature(bytes(0x50, 0x4b, 0x03, 0x04), type('doc'))).toBe(false);
  });
});

describe('contentDisposition', () => {
  it('opens a PDF and downloads Office files', () => {
    expect(contentDisposition('a.pdf', 'application/pdf')).toMatch(/^inline;/);
    expect(contentDisposition('a.docx', docx)).toMatch(/^attachment;/);
  });

  it('keeps quotes and line breaks out of the header', () => {
    const header = contentDisposition('a"b\r\nc é.pdf', 'application/pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).toContain('filename="a_b__c _.pdf"');
    expect(header).toContain("filename*=UTF-8''a%22b%0D%0Ac%20%C3%A9.pdf");
  });
});

describe('isDocumentMime', () => {
  it('is true only for the supported types', () => {
    expect(isDocumentMime('application/pdf')).toBe(true);
    expect(isDocumentMime('image/png')).toBe(false);
    expect(isDocumentMime('text/html')).toBe(false);
  });
});
