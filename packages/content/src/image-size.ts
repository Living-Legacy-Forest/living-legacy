/**
 * Width and height read from an image file's header, for the formats the CMS
 * accepts (PNG, JPEG, GIF, WebP). The server checks uploads with this rather
 * than trusting sizes the browser reports. JPEG sizes ignore EXIF rotation.
 */
export function imageSize(data: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const has = (n: number) => data.length >= n;
  const ascii = (at: number, s: string) =>
    has(at + s.length) && [...s].every((c, i) => data[at + i] === c.charCodeAt(0));

  if (ascii(1, 'PNG') && ascii(12, 'IHDR') && has(24)) {
    return size(view.getUint32(16), view.getUint32(20));
  }
  if ((ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) && has(10)) {
    return size(view.getUint16(6, true), view.getUint16(8, true));
  }
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return webpSize(data, view, ascii, has);
  if (data[0] === 0xff && data[1] === 0xd8) return jpegSize(data, view);
  return null;
}

function size(width: number, height: number) {
  return width > 0 && height > 0 ? { width, height } : null;
}

function webpSize(
  data: Uint8Array,
  view: DataView,
  ascii: (at: number, s: string) => boolean,
  has: (n: number) => boolean
) {
  if (ascii(12, 'VP8 ') && has(30)) {
    return size(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  if (ascii(12, 'VP8L') && has(25)) {
    const bits = view.getUint32(21, true);
    return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (ascii(12, 'VP8X') && has(30)) {
    const u24 = (at: number) => data[at]! | (data[at + 1]! << 8) | (data[at + 2]! << 16);
    return size(u24(24) + 1, u24(27) + 1);
  }
  return null;
}

// Start-of-frame markers carry the size; C4, C8 and CC share the range but are not frames.
const isFrame = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function jpegSize(data: Uint8Array, view: DataView) {
  let at = 2;
  while (at + 4 <= data.length) {
    if (data[at] !== 0xff) return null;
    const marker = data[at + 1]!;
    // Padding, and the markers that stand alone without a length.
    if (marker === 0xff) {
      at++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (isFrame(marker)) {
      return at + 9 <= data.length ? size(view.getUint16(at + 7), view.getUint16(at + 5)) : null;
    }
    at += 2 + view.getUint16(at + 2);
  }
  return null;
}
