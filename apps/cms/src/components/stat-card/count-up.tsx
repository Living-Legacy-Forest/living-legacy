import { animate } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { formatInteger } from '@/lib/format';

const COUNT_SECONDS = 0.9;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * A figure that counts up from zero as its card reveals, and eases to a new value
 * after a refresh. The page renders the final figure, so the server's HTML, screen
 * readers and anyone asking for reduced motion get it straight away.
 *
 * The count only plays while the CSS reveal around it ([data-reveal], styles.css) is
 * still to finish, and starts with it. Outside the dashboard there is no reveal, and on
 * a slow first load the figure may already be showing by the time the page hydrates;
 * in both cases it stays put rather than dropping to zero in front of the reader.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useLayoutEffect(() => {
    // React owns this text node; writing to it, not replacing it, keeps React in step.
    const text = ref.current?.firstChild;
    if (!text) return;
    const from = shown.current;
    shown.current = value;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const reveal = ref.current
      ?.closest<HTMLElement>('[data-reveal]')
      ?.getAnimations()
      .find((a) => a.playState !== 'finished');
    const timing = reveal?.effect?.getTiming();
    // How long until the figure starts to show: its delay, less the time already played.
    const wait = reveal
      ? Math.max(0, Number(timing?.delay ?? 0) - Number(reveal.currentTime ?? 0))
      : null;

    let start: number;
    if (wait !== null) start = 0;
    else if (from !== null && from !== value) start = from;
    else return;

    text.nodeValue = formatInteger(start);
    const controls = animate(start, value, {
      duration: COUNT_SECONDS,
      delay: (wait ?? 0) / 1000,
      ease: EASE_OUT,
      onUpdate: (v) => {
        const rounded = Math.round(v);
        shown.current = rounded;
        text.nodeValue = formatInteger(rounded);
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => {
      controls.stop();
      text.nodeValue = formatInteger(value);
    };
  }, [value]);

  return <span ref={ref}>{formatInteger(value)}</span>;
}
