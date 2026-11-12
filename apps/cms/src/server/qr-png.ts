// A QR code as a PNG, for tickets in emails: mail apps show PNG everywhere but
// often block SVG. Black and white at one bit a pixel, so the file is tiny, and
// compressed with the runtime's own deflate (CompressionStream), so no image
// library is needed in the Worker.
import { encode } from 'uqr';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** zlib-wrapped deflate, which is what a PNG's image data is. */
async function deflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * `text` as a QR code PNG, each module `scale` pixels square, with the quiet
 * zone of four modules that scanners expect around it.
 */
export async function qrPng(text: string, scale = 10): Promise<Uint8Array<ArrayBuffer>> {
  // M recovers from a scuffed or glary screen without making the code dense.
  const { data, size } = encode(text, { ecc: 'M', border: 4 });
  const width = size * scale;
  const rowBytes = Math.ceil(width / 8);

  // One filter byte (0, none) then the row's bits: 1 is white, 0 is black.
  const raw = new Uint8Array((rowBytes + 1) * width);
  for (let y = 0; y < width; y++) {
    const row = data[Math.floor(y / scale)]!;
    const offset = y * (rowBytes + 1) + 1;
    for (let x = 0; x < width; x++) {
      const i = offset + (x >> 3);
      if (!row[Math.floor(x / scale)]) raw[i] = (raw[i] ?? 0) | (0x80 >> (x & 7));
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, width);
  header[8] = 1; // bit depth
  header[9] = 0; // greyscale

  const parts = [
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}
