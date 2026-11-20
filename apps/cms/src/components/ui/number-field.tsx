import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Variants,
} from 'motion/react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { MinusIcon, PlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

// A bounded number with odometer digits and hold-to-repeat steppers, ported from a
// shadcn-registry motion library onto our tokens. Only the control is here: forms give it
// a label and hint through FormCell (`htmlFor` matches `id`), so the library's own label,
// hint row, label scrubbing and inline limit note are left out. A press past a limit
// strains the value, shakes the refused button and is announced instead.

/** Text beside the number. A function gets the value, so a unit can agree with it. */
export type NumberFieldAffix = string | ((value: number) => string);

type NumberFieldProps = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** PageUp, PageDown and Shift with an arrow move this far. Defaults to ten steps. */
  largeStep?: number;
  disabled?: boolean;
  id?: string;
  /** Text before the number, such as "$". */
  prefix?: NumberFieldAffix;
  /** Text after the number, such as " dates". */
  suffix?: NumberFieldAffix;
  /** Fraction digits follow the precision of `step` unless set here. */
  formatOptions?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  };
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

type Source = 'button' | 'key' | 'type';
type Part = { key: string; digit: number } | { key: string; text: string };

const springs = {
  snappy: { type: 'spring', visualDuration: 0.2, bounce: 0 },
  smooth: { type: 'spring', visualDuration: 0.3, bounce: 0 },
  morph: { type: 'spring', visualDuration: 0.3, bounce: 0 },
} as const;
const duration = { instant: 0.1, fast: 0.15, standard: 0.2 };
const exitEase = [0.22, 1, 0.36, 1] as const;
const blur = { subtle: 2, soft: 4 };
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/** The pause before a held control repeats, and the fastest repeat. */
const HOLD_DELAY = 400;
const HOLD_FASTEST = 40;
/** A held press keeps leaning on a limit at this cadence. */
const LIMIT_PUSH = 240;
/** Pushes within this window count as one effort, so each strains a little further, up to the cap. */
const PUSH_WINDOW = 700;
const PUSH_GAIN = 0.22;
const PUSH_CAP = 4;
// Motion drops velocity on time-defined springs, so the limit kick runs the morph spring
// expressed as stiffness and damping.
const BUMP_VELOCITY = 130;
const kick = (() => {
  const root = (2 * Math.PI) / (springs.morph.visualDuration * 1.2);
  return {
    type: 'spring' as const,
    stiffness: root * root,
    damping: 2 * (1 - springs.morph.bounce) * root,
  };
})();

const decimalsOf = (value: number) => (String(value).split('.')[1] ?? '').length;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const affixText = (affix: NumberFieldAffix | undefined, value: number) =>
  typeof affix === 'function' ? affix(value) : (affix ?? '');

/** Columns keyed by place value, so 9 → 10 keeps the ones column the ones column. */
function partsOf(value: number, format: Intl.NumberFormat): Part[] {
  const parts = format.formatToParts(value);
  let place = parts.reduce((n, part) => n + (part.type === 'integer' ? part.value.length : 0), 0);
  let fraction = 0;
  return parts.flatMap((part, index): Part[] => {
    if (part.type === 'integer')
      return [...part.value].map((char) => ({ key: `i${--place}`, digit: Number(char) }));
    if (part.type === 'fraction')
      return [...part.value].map((char) => ({ key: `f${fraction++}`, digit: Number(char) }));
    const key =
      part.type === 'group'
        ? `g${place}`
        : part.type === 'decimal'
          ? 'd'
          : part.type === 'minusSign'
            ? 'm'
            : `${part.type}${index}`;
    return [{ key, text: part.value }];
  });
}

// A new column opens its width while it rises the way the number moved; scale and opacity ride
// the width spring so a digit grows with its slot instead of landing on its neighbours.
const slot: Variants = {
  enter: (direction: number) => ({
    width: 0,
    scale: 0.7,
    opacity: 0,
    y: `${direction * 0.3}em`,
    filter: `blur(${blur.soft}px)`,
  }),
  center: {
    width: 'auto',
    scale: 1,
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transitionEnd: { filter: 'none' },
    transition: {
      width: springs.morph,
      scale: springs.morph,
      opacity: springs.morph,
      y: springs.snappy,
      filter: { duration: duration.standard, ease: exitEase },
    },
  },
  exit: (direction: number) => ({
    width: 0,
    scale: 0.7,
    opacity: 0,
    y: `${direction * -0.3}em`,
    filter: `blur(${blur.subtle}px)`,
    transition: {
      width: springs.smooth,
      scale: springs.smooth,
      y: { duration: duration.fast, ease: exitEase },
      opacity: { duration: duration.instant },
      filter: { duration: duration.instant },
    },
  }),
};
// Reduced motion keeps a short fade. While typing, columns follow the draft at once so they
// never lag the caret.
const rest = (opacity: number) => ({ width: 'auto', scale: 1, opacity, y: 0, filter: 'none' });
const still: Variants = {
  enter: rest(0),
  center: { ...rest(1), transition: { duration: duration.instant } },
  exit: { width: 0, opacity: 0, transition: { duration: 0 } },
};
const cut: Variants = {
  enter: rest(1),
  center: { ...rest(1), transition: { duration: 0 } },
  exit: { width: 0, opacity: 0, transition: { duration: 0 } },
};

// Each wheel's window reaches a little past the line box and feathers out, so a turning digit
// fades at the edge instead of being cut. It clips vertically only.
const columnStyle = {
  '--feather': '0.2em',
  marginBlock: 'calc(var(--feather) * -1)',
  paddingBlock: 'var(--feather)',
  maskImage:
    'linear-gradient(to bottom, transparent, #000 calc(var(--feather) * 1.5), #000 calc(100% - var(--feather) * 1.5), transparent)',
} as CSSProperties;

/** One digit on the wheel. Its distance from the wheel position sets where it sits and how clear it is. */
function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  // Every style reads the wheel directly: a chained transform can lag a frame and blank a jump.
  const offset = (current: number) => ((((digit - current) % 10) + 15) % 10) - 5;
  const y = useTransform(position, (current) => `${offset(current) * 1.05}em`);
  const opacity = useTransform(position, (current) =>
    Math.max(0, 1 - Math.abs(offset(current)) ** 1.5 * 1.1)
  );
  const visibility = useTransform(position, (current) =>
    Math.abs(offset(current)) >= 1 ? 'hidden' : 'visible'
  );
  const filter = useTransform(position, (current) => {
    const distance = Math.abs(offset(current));
    return distance < 0.02 || distance >= 1
      ? 'none'
      : `blur(${(distance * blur.soft * 0.75).toFixed(2)}px)`;
  });
  return (
    <motion.span
      className="absolute inset-x-0 inset-y-(--feather) text-center"
      style={{ y, opacity, filter, visibility }}
    >
      {digit}
    </motion.span>
  );
}

/** An odometer wheel. It turns the way the whole number moved, wraps 9 → 0 and retargets mid-spin. */
function Wheel({
  digit,
  direction,
  instant,
}: {
  digit: number;
  direction: number;
  instant: boolean;
}) {
  const reduced = useReducedMotion();
  const position = useMotionValue(digit);
  const wheel = useRef({ digit, target: digit });
  useLayoutEffect(() => {
    const state = wheel.current;
    if (state.digit === digit) return;
    // The way the number moved, unless that's more than half a turn: a big clamp never spins.
    let delta =
      direction > 0 ? (digit - state.digit + 10) % 10 : -((state.digit - digit + 10) % 10);
    if (Math.abs(delta) > 5) delta -= Math.sign(delta) * 10;
    state.target += delta;
    state.digit = digit;
    if (instant || reduced) position.jump(state.target);
    else animate(position, state.target, springs.snappy);
  }, [digit, direction, instant, position, reduced]);
  return (
    <>
      <span className="invisible">0</span>
      {DIGITS.map((item) => (
        <Glyph key={item} position={position} digit={item} />
      ))}
    </>
  );
}

function Digits({
  value,
  format,
  direction,
  instant,
}: {
  value: number;
  format: Intl.NumberFormat;
  direction: number;
  instant: boolean;
}) {
  const reduced = useReducedMotion();
  const variants = instant ? cut : reduced ? still : slot;
  return (
    <AnimatePresence initial={false} custom={direction}>
      {partsOf(value, format).map((part) => (
        <motion.span
          key={part.key}
          className={cn(
            'inline-block',
            'digit' in part ? 'relative overflow-y-clip' : 'overflow-x-clip whitespace-pre'
          )}
          style={'digit' in part ? columnStyle : undefined}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {'digit' in part ? (
            <Wheel digit={part.digit} direction={direction} instant={instant} />
          ) : (
            part.text
          )}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}

/** Affix characters are keyed by position, so "date" → "dates" only opens the new "s". */
function AffixText({ text, direction }: { text: string; direction: number }) {
  const reduced = useReducedMotion();
  if (!text) return null;
  return (
    <span className="text-muted-foreground inline-flex font-normal">
      <AnimatePresence initial={false} custom={direction}>
        {[...text].map((char, index) => (
          <motion.span
            key={`${index}:${char}`}
            className="inline-block overflow-x-clip whitespace-pre"
            custom={direction}
            variants={reduced ? still : slot}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

/** Pointer presses hold to repeat; keyboard and assistive clicks (detail 0) take one step. */
function StepButton({
  toward,
  name,
  disabled,
  controls,
  limit,
  pressed,
  buttonRef,
  iconRef,
  onPress,
  onRelease,
  onActivate,
}: {
  toward: 1 | -1;
  name: string;
  disabled?: boolean;
  controls: string;
  limit: boolean;
  pressed: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  iconRef: RefObject<HTMLSpanElement | null>;
  onPress: () => void;
  onRelease: () => void;
  onActivate: () => void;
}) {
  const Icon = toward > 0 ? PlusIcon : MinusIcon;
  // Out of the tab order: the input takes arrow keys. At a limit the button dims but stays
  // enabled, so a press strains the value. Mouse presses keep focus in the input, so an open
  // draft commits with the step.
  return (
    <button
      ref={buttonRef}
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-controls={controls}
      aria-label={`${toward > 0 ? 'Increase' : 'Decrease'}${name ? ` ${name}` : ''}`}
      aria-disabled={limit || undefined}
      data-pressed={pressed || undefined}
      onPointerDown={(event) => {
        if (event.button === 0) onPress();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0) onActivate();
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'text-muted-foreground grid size-6 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-[calc(var(--radius-lg)-4px)] transition-[background-color,color,opacity] duration-150 select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]',
        'touch:size-9',
        'hover:not-aria-disabled:not-disabled:bg-muted hover:not-aria-disabled:not-disabled:text-foreground',
        // Quick press, spring release: the fill deepens and the glyph sinks while it repeats.
        'active:not-aria-disabled:bg-foreground/10 active:not-aria-disabled:text-foreground data-pressed:not-aria-disabled:bg-foreground/10 data-pressed:not-aria-disabled:text-foreground active:duration-100 data-pressed:duration-100',
        '[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] active:not-aria-disabled:[&_svg]:scale-[0.82] active:not-aria-disabled:[&_svg]:duration-100 data-pressed:not-aria-disabled:[&_svg]:scale-[0.82] data-pressed:not-aria-disabled:[&_svg]:duration-100 motion-reduce:[&_svg]:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-35 aria-disabled:cursor-not-allowed aria-disabled:opacity-35',
        'data-strain:text-destructive data-strain:opacity-60 data-strain:duration-[60ms]'
      )}
    >
      <span ref={iconRef} className="grid place-items-center">
        <Icon aria-hidden className="size-4" />
      </span>
    </button>
  );
}

/**
 * Buttons and arrow keys repeat and speed up while held, PageUp and PageDown take large steps,
 * Home and End jump to the limits. Typing edits a plain draft that applies live while valid;
 * the rolling digits return once it commits on Enter, blur or the next step.
 */
function NumberField({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step: stepProp = 1,
  largeStep,
  disabled,
  id,
  prefix,
  suffix,
  formatOptions,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: NumberFieldProps) {
  const reduced = useReducedMotion();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const step = stepProp > 0 ? stepProp : 1;
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [pressed, setPressed] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const minusButton = useRef<HTMLButtonElement>(null);
  const plusButton = useRef<HTMLButtonElement>(null);
  const minusIcon = useRef<HTMLSpanElement>(null);
  const plusIcon = useRef<HTMLSpanElement>(null);
  const strainTimer = useRef<number | undefined>(undefined);
  const effort = useRef({ edge: 0, count: 0, at: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLSpanElement>(null);
  const latest = useRef(current);
  const editStart = useRef(current);
  const hold = useRef<number | undefined>(undefined);
  const shiftFrom = useRef<number | null>(null);
  const selectNext = useRef(false);
  const live = useRef<(direction: 1 | -1, steps: number, source: Source) => boolean>(() => false);
  const bumpY = useMotionValue(0);
  const shiftX = useMotionValue(0);

  const base = Number.isFinite(min) ? min : 0;
  const decimals = Math.max(decimalsOf(step), decimalsOf(base));
  const minFraction = formatOptions?.minimumFractionDigits ?? decimals;
  const maxFraction = Math.max(minFraction, formatOptions?.maximumFractionDigits ?? decimals);
  const grouping = formatOptions?.useGrouping ?? true;
  const format = useMemo(
    () =>
      new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: minFraction,
        maximumFractionDigits: maxFraction,
        useGrouping: grouping,
        numberingSystem: 'latn',
      }),
    [minFraction, maxFraction, grouping]
  );
  const round = (next: number) => Number(next.toFixed(decimals)) || 0;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const snap = (next: number) => round(base + Math.round((next - base) / step) * step);
  /** Off-grid values move to the next grid line in the direction of travel, then whole steps. */
  const stepFrom = (from: number, steps: number) => {
    const index = (from - base) / step;
    const whole = steps > 0 ? Math.floor(index + 1e-7) : Math.ceil(index - 1e-7);
    return round(base + (whole + steps) * step);
  };
  const spoken = (next: number) =>
    `${affixText(prefix, next)}${format.format(next)}${affixText(suffix, next)}`.trim();
  function parse(text: string) {
    const normalized = text.replace(/,/g, '').replace(/[^\d.-]/g, '');
    if (!/\d/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const typed = editing ? parse(draft) : null;
  const shown = typed ?? current;
  const [trail, setTrail] = useState({ value: shown, direction: 1 as 1 | -1 });
  if (trail.value !== shown) setTrail({ value: shown, direction: shown > trail.value ? 1 : -1 });
  const direction = trail.value === shown ? trail.direction : shown > trail.value ? 1 : -1;

  useEffect(
    () => () => {
      window.clearTimeout(hold.current);
      window.clearTimeout(strainTimer.current);
    },
    []
  );

  /** A press past a limit: the value strains toward it and springs home, a little further with
   * each push in a row (capped, like overscroll), and the refused button shakes once. */
  function strain(edge: 1 | -1, source: Source) {
    const now = performance.now();
    const push = effort.current;
    push.count = push.edge === edge && now - push.at < PUSH_WINDOW ? push.count + 1 : 1;
    push.edge = edge;
    push.at = now;
    const button = (edge > 0 ? plusButton : minusButton).current;
    if (button) {
      button.dataset.strain = '';
      window.clearTimeout(strainTimer.current);
      strainTimer.current = window.setTimeout(() => {
        delete button.dataset.strain;
      }, 420);
    }
    if (reduced) return;
    animate(bumpY, 0, {
      ...kick,
      velocity: -edge * BUMP_VELOCITY * (1 + Math.min(push.count - 1, PUSH_CAP) * PUSH_GAIN),
    });
    const icon = (edge > 0 ? plusIcon : minusIcon).current;
    // The refused-press wiggle is a physical shake, so it keeps its own keyframes.
    if (icon && source !== 'type')
      animate(icon, { x: [0, -2.5, 2.5, -1.5, 1, 0] }, { duration: 0.32, ease: 'easeOut' });
  }
  /** Every change lands here. A value past a limit clamps, strains and says which limit it met. */
  function commitValue(next: number, source: Source) {
    if (!Number.isFinite(next)) return false;
    const clamped = clamp(next);
    const limit = Math.sign(next - clamped);
    if (limit) {
      strain(limit > 0 ? 1 : -1, source);
      setAnnouncement(`${spoken(clamped)}, ${limit > 0 ? 'maximum' : 'minimum'}`);
    } else if (source === 'button' && clamped !== latest.current) {
      setAnnouncement(spoken(clamped));
    }
    if (clamped === latest.current) return false;
    latest.current = clamped;
    if (value === undefined) setInternal(clamped);
    onValueChange?.(clamped);
    return true;
  }
  const nudge = (toward: 1 | -1, steps: number, source: Source) =>
    commitValue(stepFrom(latest.current, toward * steps), source);
  useLayoutEffect(() => {
    latest.current = current;
    live.current = nudge;
  });

  /** The group glides back to centre when typing changes its width, instead of hopping per key. */
  function captureShift() {
    const group = groupRef.current;
    if (group && shiftFrom.current === null)
      shiftFrom.current = group.getBoundingClientRect().left - shiftX.get();
  }
  useLayoutEffect(() => {
    const from = shiftFrom.current;
    const group = groupRef.current;
    shiftFrom.current = null;
    // After a commit the caret collapses to the end, so no selection box sits over the digits.
    if (selectNext.current) {
      selectNext.current = false;
      const input = inputRef.current;
      if (input && document.activeElement === input) {
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    }
    if (from === null || !group) return;
    const delta = from - (group.getBoundingClientRect().left - shiftX.get());
    if (Math.abs(delta) < 0.5) return;
    shiftX.set(shiftX.get() + delta);
    if (reduced) shiftX.jump(0);
    else animate(shiftX, 0, springs.morph);
  });

  function commitDraft() {
    if (!editing) return;
    captureShift();
    setEditing(false);
    const parsed = parse(draft);
    if (parsed !== null) commitValue(snap(parsed), 'type');
  }
  function stopHold() {
    window.clearTimeout(hold.current);
    hold.current = undefined;
    setPressed(0);
  }
  /** One step now; after a pause, repeats that speed up until release. Held into a limit, it keeps
   * leaning on it at a steady cadence. */
  function startHold(toward: 1 | -1, amount: number, source: Source) {
    stopHold();
    commitDraft();
    const steps = Math.max(1, Math.round(amount / step));
    if (source === 'button') setPressed(toward);
    let count = 0;
    const tick = () => {
      const moved = live.current(toward, steps, source);
      hold.current = window.setTimeout(
        tick,
        moved ? Math.max(HOLD_FASTEST, 150 * 0.86 ** ++count) : LIMIT_PUSH
      );
    };
    hold.current = window.setTimeout(
      tick,
      nudge(toward, steps, source) ? HOLD_DELAY : LIMIT_PUSH + 120
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const large = largeStep ?? step * 10;
    const moves: Record<string, [1 | -1, number]> = {
      ArrowUp: [1, event.shiftKey ? large : step],
      ArrowDown: [-1, event.shiftKey ? large : step],
      PageUp: [1, large],
      PageDown: [-1, large],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      if (!event.repeat) startHold(move[0], move[1], 'key');
      return;
    }
    // Home and End reach the limits; while a draft is open they move the caret as usual.
    if (
      !editing &&
      ((event.key === 'Home' && Number.isFinite(min)) ||
        (event.key === 'End' && max < Number.MAX_SAFE_INTEGER))
    ) {
      event.preventDefault();
      commitValue(event.key === 'Home' ? min : max, 'key');
      return;
    }
    if (event.key === 'Enter') {
      // Enter commits the draft rather than submitting the surrounding form mid-edit.
      if (editing) {
        event.preventDefault();
        selectNext.current = true;
        commitDraft();
      }
    }
    if (event.key === 'Escape' && editing) {
      event.preventDefault();
      // Stop a surrounding dialog closing on the same key.
      event.stopPropagation();
      captureShift();
      setEditing(false);
      selectNext.current = true;
      commitValue(editStart.current, 'type');
    }
  }
  function onChange(text: string) {
    const allowed = new RegExp(
      `[^0-9,${decimals || maxFraction ? escape('.') : ''}${min < 0 ? '\\-' : ''}]`,
      'g'
    );
    const next = text.replace(allowed, '');
    if (!editing) editStart.current = current;
    captureShift();
    setDraft(next);
    setEditing(true);
    // Valid drafts apply as they're typed, so anything that depends on the value follows along.
    const parsed = parse(next);
    if (parsed !== null && parsed >= min && parsed <= max && snap(parsed) === parsed)
      commitValue(parsed, 'type');
  }

  const stepper = (toward: 1 | -1) => ({
    toward,
    name: ariaLabel ?? '',
    disabled,
    controls: inputId,
    limit: toward > 0 ? shown >= max : shown <= min,
    pressed: pressed === toward,
  });
  /** A typed value past a limit tints the field until it commits and springs back. */
  const outside = typed !== null && (typed > max || typed < min);

  return (
    <div
      data-slot="number-field"
      data-disabled={disabled || undefined}
      data-invalid={ariaInvalid || outside || undefined}
      className={cn(
        'border-input dark:bg-input/30 flex h-8 w-36 max-w-full min-w-0 items-center gap-0.5 rounded-lg border bg-transparent p-[3px] transition-[border-color,background-color,opacity] duration-150',
        'touch:h-9',
        'hover:border-ring/60 has-[input:focus]:border-ring',
        'data-invalid:border-destructive data-invalid:bg-destructive/5 dark:data-invalid:border-destructive/50',
        'data-disabled:bg-input/50 data-disabled:opacity-50',
        className
      )}
    >
      <StepButton
        {...stepper(-1)}
        buttonRef={minusButton}
        iconRef={minusIcon}
        onPress={() => startHold(-1, step, 'button')}
        onRelease={stopHold}
        onActivate={() => {
          commitDraft();
          nudge(-1, 1, 'button');
        }}
      />
      {/* A click anywhere on the value focuses the input; keyboard users reach the input itself. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mouse-only focus target */}
      <div
        className={cn(
          'relative flex min-w-0 flex-1 cursor-text items-center justify-center self-stretch',
          disabled && 'cursor-not-allowed'
        )}
        onMouseDown={(event) => {
          if (event.target !== inputRef.current) event.preventDefault();
        }}
        onClick={(event) => {
          if (!disabled && event.target !== inputRef.current) {
            inputRef.current?.focus();
            inputRef.current?.select();
          }
        }}
      >
        {/* The number and its affixes travel as one centred group; tabular digits keep columns even. */}
        <motion.span
          ref={groupRef}
          className="text-foreground md:text-ui inline-flex items-center text-base font-medium whitespace-nowrap tabular-nums"
          style={{ x: shiftX, y: bumpY }}
        >
          <AffixText text={affixText(prefix, shown)} direction={direction} />
          {/* The input only draws the caret and selection; a span always paints the text (the
              digits, or the draft mirror while typing), so the value keeps one weight and place. */}
          <span className="relative inline-grid items-center">
            {/* Opacity as well as visibility: each glyph sets its own visibility, which would show through. */}
            <span
              aria-hidden
              className={cn(
                'col-start-1 row-start-1 inline-flex',
                editing && 'invisible absolute top-0 left-0 opacity-0'
              )}
            >
              <Digits value={shown} format={format} direction={direction} instant={editing} />
            </span>
            {editing && (
              <span aria-hidden className="col-start-1 row-start-1 whitespace-pre">
                {draft}
              </span>
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              role="spinbutton"
              inputMode={min < 0 ? 'text' : decimals || maxFraction ? 'decimal' : 'numeric'}
              autoComplete="off"
              spellCheck={false}
              value={editing ? draft : format.format(current)}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid || outside || undefined}
              aria-valuenow={current}
              aria-valuetext={spoken(current)}
              aria-valuemin={Number.isFinite(min) ? min : undefined}
              aria-valuemax={max < Number.MAX_SAFE_INTEGER ? max : undefined}
              onChange={(event) => onChange(event.currentTarget.value)}
              onKeyDown={onKeyDown}
              onKeyUp={(event) => {
                if (/^(Arrow(Up|Down)|Page(Up|Down))$/.test(event.key)) stopHold();
              }}
              onBlur={() => {
                stopHold();
                commitDraft();
              }}
              className="caret-foreground selection:bg-foreground/15 absolute top-0 left-0 z-1 m-0 h-full w-[calc(100%+1em)] border-0 bg-transparent p-0 text-left text-transparent outline-none selection:text-transparent disabled:cursor-not-allowed"
              style={{ font: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit' }}
            />
          </span>
          <AffixText text={affixText(suffix, shown)} direction={direction} />
        </motion.span>
      </div>
      <StepButton
        {...stepper(1)}
        buttonRef={plusButton}
        iconRef={plusIcon}
        onPress={() => startHold(1, step, 'button')}
        onRelease={stopHold}
        onActivate={() => {
          commitDraft();
          nudge(1, 1, 'button');
        }}
      />
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

export { NumberField };
