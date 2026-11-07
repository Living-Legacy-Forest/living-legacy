import { describe, expect, it } from 'vitest';
import { imageExtension, imageSize } from './image-size';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))
  );
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >> 8) & 255];
const u24le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

describe('imageSize', () => {
  it('reads a PNG header', () => {
    const png = bytes(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      u32be(13),
      'IHDR',
      u32be(5760),
      u32be(3840)
    );
    expect(imageSize(png)).toEqual({ width: 5760, height: 3840 });
  });

  it('reads a GIF header', () => {
    expect(imageSize(bytes('GIF89a', u16le(320), u16le(200)))).toEqual({
      width: 320,
      height: 200,
    });
  });

  it('reads a JPEG frame header, skipping the segments before it', () => {
    const app0 = [0xff, 0xe0, ...u16be(6), 1, 2, 3, 4];
    const sof0 = [0xff, 0xc0, ...u16be(11), 8, ...u16be(1080), ...u16be(1920), 3];
    expect(imageSize(bytes([0xff, 0xd8], app0, sof0))).toEqual({ width: 1920, height: 1080 });
  });

  it('does not take a JPEG huffman table for a frame header', () => {
    const dht = [0xff, 0xc4, ...u16be(4), 0, 0];
    const sof2 = [0xff, 0xc2, ...u16be(11), 8, ...u16be(600), ...u16be(800), 3];
    expect(imageSize(bytes([0xff, 0xd8], dht, sof2))).toEqual({ width: 800, height: 600 });
  });

  it('reads lossy, lossless and extended WebP', () => {
    const riff = (chunk: string, body: number[]) =>
      bytes('RIFF', u32be(0), 'WEBP', chunk, u32be(0), body);
    // VP8: frame tag (3 bytes), start code, then 14-bit width and height.
    expect(
      imageSize(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(1280), ...u16le(720)]))
    ).toEqual({ width: 1280, height: 720 });
    // VP8L: signature byte, then width-1 and height-1 packed in 14 bits each.
    const w = 640 - 1;
    const h = 480 - 1;
    const packed = w | (h << 14);
    expect(
      imageSize(
        riff('VP8L', [0x2f, packed & 255, (packed >> 8) & 255, (packed >> 16) & 255, packed >>> 24])
      )
    ).toEqual({ width: 640, height: 480 });
    // VP8X: flags and reserved bytes, then 24-bit width-1 and height-1.
    expect(imageSize(riff('VP8X', [0, 0, 0, 0, ...u24le(2559), ...u24le(1439)]))).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  describe('AVIF', () => {
    // An ISO-BMFF box: 32-bit size (header included), four-letter type, body.
    const box = (type: string, ...body: number[][]) => {
      const content = body.flat();
      return [...u32be(8 + content.length), ...[...type].map((c) => c.charCodeAt(0)), ...content];
    };
    const fourcc = (s: string) => [...s].map((c) => c.charCodeAt(0));
    const ftyp = (major: string, ...compatible: string[]) =>
      box('ftyp', fourcc(major), u32be(0), ...compatible.map(fourcc));
    // `ispe` is a full box: version and flags, then width and height.
    const ispe = (w: number, h: number) => box('ispe', [0, 0, 0, 0], u32be(w), u32be(h));
    const meta = (...props: number[][]) =>
      box('meta', [0, 0, 0, 0], box('iprp', box('ipco', ...props)));

    it('reads the image size from the item properties', () => {
      const avif = new Uint8Array([...ftyp('avif', 'mif1', 'avif'), ...meta(ispe(3000, 2000))]);
      expect(imageSize(avif)).toEqual({ width: 3000, height: 2000 });
    });

    it('takes the largest size when there are tiles or a thumbnail', () => {
      const avif = new Uint8Array([
        ...ftyp('avif'),
        ...meta(ispe(512, 512), ispe(4096, 2304), ispe(320, 180)),
      ]);
      expect(imageSize(avif)).toEqual({ width: 4096, height: 2304 });
    });

    it('crops to the clean aperture, as an odd-sized image is stored padded to even sides', () => {
      // clap: width, height and two offsets, each a numerator and a denominator.
      const clap = (w: number, h: number) =>
        box('clap', u32be(w), u32be(1), u32be(h), u32be(1), u32be(0), u32be(1), u32be(0), u32be(1));
      const avif = new Uint8Array([...ftyp('avif'), ...meta(ispe(98, 82), clap(97, 81))]);
      expect(imageSize(avif)).toEqual({ width: 97, height: 81 });
    });

    it('accepts AVIF named only as a compatible brand, and image sequences', () => {
      expect(imageSize(new Uint8Array([...ftyp('mif1', 'avif'), ...meta(ispe(800, 600))]))).toEqual(
        { width: 800, height: 600 }
      );
      expect(imageSize(new Uint8Array([...ftyp('avis'), ...meta(ispe(640, 360))]))).toEqual({
        width: 640,
        height: 360,
      });
    });

    it('refuses HEIC, which shares the container', () => {
      expect(
        imageSize(new Uint8Array([...ftyp('heic', 'mif1'), ...meta(ispe(800, 600))]))
      ).toBeNull();
    });

    it('returns null for a truncated or malformed file', () => {
      const whole = [...ftyp('avif'), ...meta(ispe(800, 600))];
      expect(imageSize(new Uint8Array(whole.slice(0, whole.length - 4)))).toBeNull();
      // A box claiming to be smaller than its own header must not loop forever.
      expect(
        imageSize(new Uint8Array([...ftyp('avif'), ...u32be(4), ...fourcc('meta')]))
      ).toBeNull();
    });
  });

  it('returns null for anything it cannot read', () => {
    expect(imageSize(bytes('not an image at all'))).toBeNull();
    expect(imageSize(bytes([0x89, 0x50]))).toBeNull();
    expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
  });
});

describe('imageExtension', () => {
  it('names the stored file by its checked type', () => {
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/png')).toBe('png');
    expect(imageExtension('image/avif')).toBe('avif');
  });
});
