/**
 * Width and height read from an image file's header, for the formats the CMS
 * accepts (PNG, JPEG, GIF, WebP, AVIF). The server checks uploads with this
 * rather than trusting sizes the browser reports. JPEG and AVIF sizes ignore
 * rotation (EXIF, `irot`).
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
  if (ascii(4, 'ftyp')) return avifSize(data, view);
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

type Box = { type: string; body: number; end: number };

/** The boxes laid end to end between `start` and `end`, stopping at the first malformed one. */
function boxes(data: Uint8Array, view: DataView, start: number, end: number): Box[] {
  const found: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const size = view.getUint32(at);
    // 0 runs to the end; 1 means a 64-bit size follows, only ever used for the
    // pixel data, which comes after everything read here.
    const boxEnd = size === 0 ? end : at + size;
    if (size === 1 || size < 8 || boxEnd > end) break;
    found.push({
      type: String.fromCharCode(...data.subarray(at + 4, at + 8)),
      body: at + 8,
      end: boxEnd,
    });
    at = boxEnd;
  }
  return found;
}

/**
 * AVIF (an ISO-BMFF file, like HEIC) keeps each image item's size in an `ispe`
 * property under meta → iprp → ipco. A tiled or thumbnailed file has several;
 * the largest is the full image, which is the size that matters here.
 */
function avifSize(data: Uint8Array, view: DataView) {
  const top = boxes(data, view, 0, data.length);
  const ftyp = top[0];
  if (ftyp?.type !== 'ftyp') return null;
  // Major brand, a 4-byte minor version, then the compatible brands.
  const brands = [ftyp.body, ...range(ftyp.body + 8, ftyp.end, 4)].map((at) =>
    at + 4 <= ftyp.end ? String.fromCharCode(...data.subarray(at, at + 4)) : ''
  );
  if (!brands.includes('avif') && !brands.includes('avis')) return null;

  const meta = top.find((b) => b.type === 'meta');
  // `meta` is a full box: 4 bytes of version and flags before its children.
  const iprp = meta && boxes(data, view, meta.body + 4, meta.end).find((b) => b.type === 'iprp');
  const ipco = iprp && boxes(data, view, iprp.body, iprp.end).find((b) => b.type === 'ipco');
  if (!ipco) return null;

  let best: { width: number; height: number } | null = null;
  let clean: { width: number; height: number } | null = null;
  for (const b of boxes(data, view, ipco.body, ipco.end)) {
    if (b.type === 'ispe' && b.body + 12 <= b.end) {
      const found = size(view.getUint32(b.body + 4), view.getUint32(b.body + 8));
      if (found && (!best || found.width * found.height > best.width * best.height)) best = found;
    }
    // AV1 stores odd sides padded to even ones; the clean aperture (`clap`,
    // width and height as fractions) is the part browsers show.
    if (b.type === 'clap' && b.body + 16 <= b.end) {
      const ratio = (at: number) => view.getUint32(at) / view.getUint32(at + 4);
      clean = size(Math.round(ratio(b.body)), Math.round(ratio(b.body + 8)));
    }
  }
  if (best && clean && clean.width <= best.width && clean.height <= best.height) return clean;
  return best;
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.max(0, Math.ceil((to - from) / step)) }, (_, i) => from + i * step);

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
