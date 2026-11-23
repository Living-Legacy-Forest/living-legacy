import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from 'react';
import { tick } from '@/lib/haptics';
import { cn } from '@/lib/utils';

/** The knob turns this far either side of straight up; the gap at the bottom is its dead zone. */
const SWEEP = 135;

type DetentDialProps = {
  /** A whole number from `min` to `max`; one that is between two detents shows on the nearer. */
  value: number;
  /** `commit` is false while the knob is being turned and true once it is let go or a key is pressed. */
  onChange: (value: number, commit: boolean) => void;
  min?: number;
  max?: number;
  /** How far apart the detents are. */
  step?: number;
  'aria-labelledby'?: string;
  'aria-valuetext'?: string;
  className?: string;
};

/**
 * A rotary knob that clicks from one detent to the next: drag round it (or use the arrow keys,
 * Home and End) and it holds at each stop, with a tick for every one and a tap of vibration on
 * phones that support it (Android and iPhone) and a small press of the knob everywhere. It is a slider to a screen reader.
 */
export function DetentDial({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 10,
  className,
  ...aria
}: DetentDialProps) {
  const stops = Math.round((max - min) / step);
  const index = Math.min(stops, Math.max(0, Math.round((value - min) / step)));
  const dragging = useRef(false);
  const lastAngle = useRef(0);
  const lastIndex = useRef(index);
  const cap = useRef<HTMLSpanElement>(null);
  const ticks = useRef<(HTMLSpanElement | null)[]>([]);
  const settled = useRef(index);

  // The click, for screens with no vibration (a Mac has none): the cap presses in and the tick
  // it lands on stretches, then both settle. Not on first paint, and not for reduced motion.
  useEffect(() => {
    if (settled.current === index) return;
    settled.current = index;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const options = { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    cap.current?.animate([{ transform: 'scale(0.93)' }, { transform: 'scale(1)' }], options);
    ticks.current[index]?.animate(
      [{ transform: 'scaleY(1.9)' }, { transform: 'scaleY(1)' }],
      options
    );
  }, [index]);

  const angleOf = (i: number) => (stops === 0 ? 0 : -SWEEP + (i / stops) * SWEEP * 2);
  const valueOf = (i: number) => min + i * step;

  function turnTo(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    // Degrees clockwise from straight up. Pointing into the dead zone holds the nearer end, so
    // dragging across the bottom never jumps from one end to the other.
    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (Math.abs(angle) > SWEEP) angle = lastAngle.current >= 0 ? SWEEP : -SWEEP;
    lastAngle.current = angle;
    const next = Math.round(((angle + SWEEP) / (SWEEP * 2)) * stops);
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      if (!commit) tick();
    }
    onChange(valueOf(next), commit);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const jump = event.shiftKey ? 3 : 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = index + jump;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = index - jump;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops;
    if (next === null) return;
    event.preventDefault();
    next = Math.min(stops, Math.max(0, next));
    if (next !== index) onChange(valueOf(next), true);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={valueOf(index)}
      aria-orientation="horizontal"
      {...aria}
      className={cn(
        'focus-visible:ring-ring/50 relative size-[72px] shrink-0 cursor-grab touch-none rounded-full outline-none select-none focus-visible:ring-[3px] active:cursor-grabbing',
        className
      )}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        lastAngle.current = angleOf(index);
        lastIndex.current = index;
        turnTo(event, false);
      }}
      onPointerMove={(event) => {
        if (dragging.current) turnTo(event, false);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        dragging.current = false;
        turnTo(event, true);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onChange(valueOf(index), true);
      }}
    >
      {Array.from({ length: stops + 1 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ transform: `rotate(${angleOf(i)}deg)` }}
        >
          <span
            ref={(el) => {
              ticks.current[i] = el;
            }}
            className={cn(
              'absolute top-0 left-1/2 h-1.5 w-0.5 origin-top -translate-x-1/2 rounded-full',
              i <= index ? 'bg-primary' : 'bg-border'
            )}
          />
        </span>
      ))}
      <span
        ref={cap}
        aria-hidden
        className="bg-secondary border-border pointer-events-none absolute inset-3 rounded-full border shadow-sm"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `rotate(${angleOf(index)}deg)` }}
      >
        <span className="bg-primary absolute top-4 left-1/2 size-1.5 -translate-x-1/2 rounded-full" />
      </span>
    </div>
  );
}
