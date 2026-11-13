import {
  AnimatePresence,
  animate,
  cancelFrame,
  frame,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motionTokens } from '@/components/arc/lib/motion-tokens';
import styles from './rolling-number.module.css';

/*
 * A number whose digits roll to each new value, like an odometer. The wheels, springs and
 * column widths are the usage meter's (components/arc/usage-meter), so every changing figure
 * moves the same way. On a dashboard card it also rolls up from zero as the card reveals.
 */

const { spring, blur } = motionTokens;
/** Motion drops inherited velocity on time-defined springs, so these are written as stiffness and damping. */
const physical = ({ visualDuration, bounce }: { visualDuration: number; bounce: number }) => {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  return {
    type: 'spring' as const,
    stiffness: root * root,
    damping: 2 * (1 - bounce) * root,
    restDelta: 0.01,
    restSpeed: 0.02,
  };
};
const turn = physical(spring.smooth);
const fit = physical(spring.morph);

/** Starts on the next frame, so the render that caused it never swallows a spring's first frames. */
function soon(start: () => { stop: () => void }) {
  let controls: { stop: () => void } | null = null;
  const run = () => {
    controls = start();
  };
  frame.update(run);
  return () => {
    cancelFrame(run);
    controls?.stop();
  };
}

type Part = { key: string; digit: number } | { key: string; text: string };
const formats = new Map<string, Intl.NumberFormat>();
const formatFor = (decimals: number, signed: boolean) => {
  const id = `${decimals}|${signed}`;
  let format = formats.get(id);
  if (!format) {
    format = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      ...(signed && { signDisplay: 'exceptZero' as const }),
    });
    formats.set(id, format);
  }
  return format;
};

/** Split a number into columns keyed by place value, so 9 → 10 keeps the ones column and a new tens column opens. */
function partsFor(value: number, decimals: number, signed: boolean): Part[] {
  const parts = formatFor(decimals, signed).formatToParts(value);
  let place = parts.reduce(
    (count, part) => count + (part.type === 'integer' ? part.value.length : 0),
    0
  );
  let fraction = 0;
  return parts.flatMap((part, index): Part[] => {
    if (part.type === 'integer') {
      return [...part.value].map((char) => ({ key: `i${--place}`, digit: Number(char) }));
    }
    if (part.type === 'fraction') {
      return [...part.value].map((char) => ({ key: `f${fraction++}`, digit: Number(char) }));
    }
    return [
      {
        key:
          part.type === 'group'
            ? `g${place}`
            : part.type === 'decimal'
              ? 'd'
              : `${part.type}${index}`,
        text: part.value,
      },
    ];
  });
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** One digit on a wheel; its distance from the wheel position sets where it sits and how clearly it shows. */
function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, (current) => ((((digit - current) % 10) + 15) % 10) - 5);
  const y = useTransform(offset, (current) => `${current}em`);
  const opacity = useTransform(offset, (current) => Math.max(0, 1 - Math.abs(current)));
  const filter = useTransform(offset, (current) =>
    Math.abs(current) < 0.02 || Math.abs(current) >= 1
      ? 'none'
      : `blur(${(Math.abs(current) * blur.subtle).toFixed(2)}px)`
  );
  return (
    <motion.span className={styles.glyph} style={{ y, opacity, filter }}>
      {digit}
    </motion.span>
  );
}

const column = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 'auto', opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

/** A digit wheel that always turns the way the whole number moved, wrapping 9 → 0 like an odometer. */
function Column({
  digit,
  direction,
  reduced,
}: {
  digit: number;
  direction: number;
  reduced: boolean;
}) {
  const position = useMotionValue(digit);
  const wheel = useRef({ digit, target: digit });
  const running = useRef<(() => void) | null>(null);
  useEffect(() => () => running.current?.(), []);
  useEffect(() => {
    const state = wheel.current;
    if (state.digit === digit) return;
    state.target +=
      direction < 0 ? -((state.digit - digit + 10) % 10) : (digit - state.digit + 10) % 10;
    state.digit = digit;
    running.current?.();
    if (reduced) {
      position.jump(state.target);
      running.current = null;
      return;
    }
    const target = state.target;
    running.current = soon(() => animate(position, target, turn));
  }, [digit, direction, position, reduced]);
  return (
    <motion.span className={styles.column} {...column} transition={reduced ? { duration: 0 } : fit}>
      <span className={styles.sizer}>0</span>
      {DIGITS.map((item) => (
        <Glyph key={item} position={position} digit={item} />
      ))}
    </motion.span>
  );
}

/** The wheels for one value. Decoration over text that screen readers get elsewhere. */
function Wheels({
  value,
  decimals,
  signed,
  reduced,
}: {
  value: number;
  decimals: number;
  signed: boolean;
  reduced: boolean;
}) {
  const [trend, setTrend] = useState({ value, direction: 1 });
  if (trend.value !== value) setTrend({ value, direction: value > trend.value ? 1 : -1 });
  return (
    <span className={styles.ticker} aria-hidden="true">
      <AnimatePresence initial={false}>
        {partsFor(value, decimals, signed).map((part) =>
          'digit' in part ? (
            <Column
              key={part.key}
              digit={part.digit}
              direction={trend.direction}
              reduced={reduced}
            />
          ) : (
            <motion.span
              key={part.key}
              className={styles.symbol}
              {...column}
              transition={reduced ? { duration: 0 } : fit}
            >
              {part.text}
            </motion.span>
          )
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * How long until the card around the figure starts to show: the delay of its reveal
 * ([data-reveal], styles.css), less the time already played. Null when it is not revealing.
 */
function revealWait(node: HTMLElement | null) {
  const reveal = node
    ?.closest<HTMLElement>('[data-reveal]')
    ?.getAnimations()
    .find((a) => a.playState !== 'finished');
  if (!reveal) return null;
  const timing = reveal.effect?.getTiming();
  return Math.max(0, Number(timing?.delay ?? 0) - Number(reveal.currentTime ?? 0));
}

/**
 * A number that rolls to each new value, and rolls up from zero as the card around it reveals.
 * The page renders the final figure, so the server's HTML, screen readers and anyone asking for
 * reduced motion get it straight away.
 */
export function RollingNumber({
  value,
  decimals = 0,
  signed = false,
}: {
  value: number;
  /** Digits after the decimal point. */
  decimals?: number;
  /** Show a + before a rise, and a - before a fall. */
  signed?: boolean;
}) {
  const reduced = !!useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const first = useRef(true);

  useLayoutEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    if (first.current) {
      first.current = false;
      const wait = revealWait(ref.current);
      if (wait !== null) {
        // Before the first paint, so the figure never shows its final value and then drops.
        setShown(0);
        const timer = setTimeout(() => setShown(value), wait);
        return () => clearTimeout(timer);
      }
      return;
    }
    setShown(value);
  }, [value, reduced]);

  return (
    <span ref={ref}>
      <span className="sr-only">{formatFor(decimals, signed).format(value)}</span>
      <Wheels value={shown} decimals={decimals} signed={signed} reduced={reduced} />
    </span>
  );
}
