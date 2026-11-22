import { useSyncExternalStore } from 'react';
import { SOUNDS, type SoundName } from './sounds';

// Short sounds for the interactions that already pass through the shared components, so a new
// screen gets them for free. Kept in this browser only, like the shortcuts: each editor decides.
// On by default; `useSoundEnabled` is the switch in the account menu.

export type { SoundName };

const STORAGE_KEY = 'll-cms-sound';

/** Quiet on purpose: these play often, and the loudest one is only ever a confirmation. */
const VOLUME: Record<SoundName, number> = {
  tap: 0.35,
  on: 0.4,
  off: 0.4,
  open: 0.3,
  close: 0.3,
  select: 0.35,
  success: 0.35,
  error: 0.4,
};

/** A sound asked for again inside this window is dropped, so one gesture never doubles up. */
const MIN_GAP_MS = 60;

const listeners = new Set<() => void>();
let enabled: boolean | null = null;

function isEnabled() {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Blocked storage falls back to the default.
    enabled = true;
  }
  return enabled;
}

export function setSoundEnabled(next: boolean) {
  enabled = next;
  try {
    if (next) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, 'off');
  } catch {
    // Still applies until the page is closed.
  }
  listeners.forEach((listener) => listener());
  // The person just turned it on: confirm that it works.
  if (next) play('on');
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether sounds are on, kept up to date as it is changed. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, isEnabled, () => true);
}

let context: AudioContext | null = null;
const buffers = new Map<SoundName, Promise<AudioBuffer>>();
const lastPlayed = new Map<SoundName, number>();

function decode(name: SoundName, ctx: AudioContext) {
  let buffer = buffers.get(name);
  if (!buffer) {
    const base64 = SOUNDS[name].split(',')[1] ?? '';
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    buffer = ctx.decodeAudioData(bytes.buffer);
    // A failed decode is not kept, so the next call tries again.
    buffer.catch(() => buffers.delete(name));
    buffers.set(name, buffer);
  }
  return buffer;
}

function start(name: SoundName, ctx: AudioContext) {
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < MIN_GAP_MS) return;
  lastPlayed.set(name, now);

  void (async () => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = await decode(name, ctx);
    gain.gain.value = VOLUME[name];
    source.connect(gain).connect(ctx.destination);
    source.start();
  })().catch(() => {
    // A sound that will not play is never worth an error.
  });
}

/** For an `onOpenChange`: the sound of a dialog or sheet opening or closing. */
export const playOpen = (open: boolean) => play(open ? 'open' : 'close');

/** What a press can land on: native controls, and the roles that stand in for them. */
const TAPPABLE =
  'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"]';

/**
 * Plays a tap for a click on any button or link, so plain elements outside the shared
 * components answer too. It runs before the component's own handler, which is how a switch,
 * menu item or dialog replaces the tap with its own sound. A control that opens something is
 * left to that opening, and a disabled one stays quiet.
 *
 * Returns the function that removes the listener.
 */
export function listenForTaps(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest(TAPPABLE) : null;
    if (!target || target.matches(':disabled, [aria-disabled="true"], [aria-haspopup]')) return;
    play('tap');
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

let pendingTap: ReturnType<typeof setTimeout> | undefined;

/**
 * Plays one of the interface sounds. Safe to call anywhere: it does nothing on the server or
 * when sound is off. Browsers only allow audio after a tap or key press, so the first call
 * from one wakes the audio context while it still counts as that gesture.
 *
 * A tap waits one tick: a button that also opens a dialog or switches something says so with
 * the more specific sound, which replaces the tap instead of playing over it.
 */
export function play(name: SoundName) {
  if (typeof window === 'undefined' || !isEnabled()) return;
  let ctx: AudioContext;
  try {
    ctx = context ??= new AudioContext();
  } catch {
    return; // No Web Audio here.
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  if (name === 'tap') {
    pendingTap ??= setTimeout(() => {
      pendingTap = undefined;
      start('tap', ctx);
    }, 0);
    return;
  }
  clearTimeout(pendingTap);
  pendingTap = undefined;
  start(name, ctx);
}
