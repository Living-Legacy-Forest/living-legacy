import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The Web Audio calls are faked; what is under test is when a sound is, and is not, started.
let started: number;
let stored: string | null;

function stubBrowser() {
  started = 0;
  const context = {
    state: 'running',
    resume: vi.fn(async () => {}),
    destination: {},
    decodeAudioData: vi.fn(async () => ({})),
    createGain: () => ({ gain: { value: 1 }, connect: () => ({}) }),
    createBufferSource: () => ({
      buffer: null,
      connect: (gain: unknown) => gain,
      start: () => {
        started += 1;
      },
    }),
  };
  vi.stubGlobal('window', {});
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return context;
      }
    }
  );
  vi.stubGlobal('localStorage', {
    getItem: () => stored,
    setItem: (_key: string, value: string) => (stored = value),
    removeItem: () => (stored = null),
  });
  return context;
}

/** A fresh copy of the module, since the preference and the dedupe are kept in module state. */
async function load() {
  vi.resetModules();
  return import('./index');
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  stored = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('play', () => {
  it('does nothing outside a browser', async () => {
    const { play } = await load();
    expect(() => play('success')).not.toThrow();
  });

  it('plays a sound', async () => {
    stubBrowser();
    const { play } = await load();
    play('success');
    await settle();
    expect(started).toBe(1);
  });

  it('stays silent when sound is off', async () => {
    stubBrowser();
    stored = 'off';
    const { play } = await load();
    play('success');
    await settle();
    expect(started).toBe(0);
  });

  it('lets a more specific sound replace the tap of the same press', async () => {
    stubBrowser();
    const { play, playOpen } = await load();
    play('tap');
    playOpen(true);
    await settle();
    expect(started).toBe(1);
  });

  it('plays a lone tap', async () => {
    stubBrowser();
    const { play } = await load();
    play('tap');
    await settle();
    expect(started).toBe(1);
  });

  it('drops the same sound asked for twice at once', async () => {
    stubBrowser();
    const { play } = await load();
    play('select');
    play('select');
    await settle();
    expect(started).toBe(1);
  });

  it('wakes a suspended audio context while it still counts as the gesture', async () => {
    const context = stubBrowser();
    context.state = 'suspended';
    const { play } = await load();
    play('on');
    expect(context.resume).toHaveBeenCalledOnce();
  });
});

describe('the preference', () => {
  it('is remembered, and turning sound on confirms it with a sound', async () => {
    stubBrowser();
    stored = 'off';
    const { setSoundEnabled } = await load();
    setSoundEnabled(true);
    await settle();
    expect(stored).toBeNull();
    expect(started).toBe(1);
  });

  it('is stored when turned off', async () => {
    stubBrowser();
    const { setSoundEnabled } = await load();
    setSoundEnabled(false);
    expect(stored).toBe('off');
  });
});

describe('listenForTaps', () => {
  // The DOM is faked down to what the listener reads: a click's target, `closest` and `matches`.
  class FakeElement {
    constructor(
      private readonly tappable: boolean,
      private readonly quiet = false
    ) {}
    closest() {
      return this.tappable ? this : null;
    }
    matches() {
      return this.quiet;
    }
  }

  function stubDocument() {
    let handler: ((event: unknown) => void) | undefined;
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('document', {
      addEventListener: (_type: string, fn: (event: unknown) => void) => (handler = fn),
      removeEventListener: () => (handler = undefined),
    });
    return {
      click: (target: unknown) => handler?.({ target }),
      attached: () => handler !== undefined,
    };
  }

  it('taps for a click on a button or link', async () => {
    stubBrowser();
    const page = stubDocument();
    const { listenForTaps } = await load();
    listenForTaps();
    page.click(new FakeElement(true));
    await settle();
    expect(started).toBe(1);
  });

  it('stays silent for a click on anything else', async () => {
    stubBrowser();
    const page = stubDocument();
    const { listenForTaps } = await load();
    listenForTaps();
    page.click(new FakeElement(false));
    await settle();
    expect(started).toBe(0);
  });

  it('leaves a disabled control, or one that opens something, to its own sound', async () => {
    stubBrowser();
    const page = stubDocument();
    const { listenForTaps } = await load();
    listenForTaps();
    page.click(new FakeElement(true, true));
    await settle();
    expect(started).toBe(0);
  });

  it('lets the control replace the tap with its own sound', async () => {
    stubBrowser();
    const page = stubDocument();
    const { listenForTaps, play } = await load();
    listenForTaps();
    page.click(new FakeElement(true));
    play('on');
    await settle();
    expect(started).toBe(1);
  });

  it('stops listening when removed', async () => {
    stubBrowser();
    const page = stubDocument();
    const { listenForTaps } = await load();
    const stop = listenForTaps();
    expect(page.attached()).toBe(true);
    stop();
    expect(page.attached()).toBe(false);
  });
});
