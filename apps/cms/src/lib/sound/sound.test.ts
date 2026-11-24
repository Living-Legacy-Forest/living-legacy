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

  it('drops the same sound asked for twice at once', async () => {
    stubBrowser();
    const { play } = await load();
    play('success');
    play('success');
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

describe('wakeAudioOnGesture', () => {
  function stubDocument() {
    const handlers = new Map<string, () => void>();
    vi.stubGlobal('document', {
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: (type: string) => handlers.delete(type),
    });
    return handlers;
  }

  it('wakes a suspended context on a press, silently, then stops listening', async () => {
    const context = stubBrowser();
    context.state = 'suspended';
    context.resume.mockImplementation(async () => {
      context.state = 'running';
    });
    const handlers = stubDocument();
    const { wakeAudioOnGesture } = await load();
    wakeAudioOnGesture();
    handlers.get('pointerdown')?.();
    expect(context.resume).toHaveBeenCalledOnce();
    await settle();
    handlers.get('pointerdown')?.();
    expect(handlers.size).toBe(0);
    expect(started).toBe(0);
  });

  it('leaves the audio asleep when sound is off', async () => {
    const context = stubBrowser();
    context.state = 'suspended';
    stored = 'off';
    const handlers = stubDocument();
    const { wakeAudioOnGesture } = await load();
    wakeAudioOnGesture();
    handlers.get('keydown')?.();
    expect(context.resume).not.toHaveBeenCalled();
  });
});
