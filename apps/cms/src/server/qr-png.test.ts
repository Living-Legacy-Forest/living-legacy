import { readBarcodes } from 'zxing-wasm/reader';
import { describe, expect, it } from 'vitest';
import { qrPng } from './qr-png';

describe('qrPng', () => {
  it('makes a one-bit greyscale PNG of the right size', async () => {
    const png = await qrPng('LL-7K3QXM', 10);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR');
    // A version 1 code is 21 modules, plus four either side for the quiet zone.
    expect(view.getUint32(16)).toBe(290);
    expect(view.getUint32(20)).toBe(290);
    expect(png[24]).toBe(1);
    expect(png[25]).toBe(0);
  });

  it('scans back to the text it was made from', async () => {
    const png = await qrPng('LL-7K3QXM');
    const [result] = await readBarcodes(new Blob([png], { type: 'image/png' }), {
      formats: ['QRCode'],
    });
    expect(result?.text).toBe('LL-7K3QXM');
  });
});
