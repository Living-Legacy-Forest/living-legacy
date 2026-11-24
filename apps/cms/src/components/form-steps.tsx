// A long form in steps: the bar showing where it is up to, the moving between
// steps, and the step's content. A saved item can pass `onPick` to let any step
// be gone to directly, so a small change does not mean walking through them all.
import { useEffect, useRef, useState } from 'react';
import { reportInvalid } from '@/lib/form-validation';
import { cn } from '@/lib/utils';

/** Fields a finger can hit on devices that cannot hover. */
export const TOUCH_FIELDS =
  'touch:**:data-[slot=input]:h-10 touch:**:data-[slot=select-trigger]:h-10!';

export function useFormSteps({
  count,
  canGoForward,
}: {
  count: number;
  /** A check of its own for moving on from a step, beyond its fields'. Reports what is wrong. */
  canGoForward?: (step: number) => boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  // Which way the steps move, so the new one slides in from that side.
  const [forward, setForward] = useState(true);

  // A new step starts from its top, not as far down as the last one was scrolled.
  const shown = useRef(step);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    form.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  /** Shows a step without checking the one being left. */
  function show(to: number) {
    setForward(to > step);
    setStep(to);
  }

  /**
   * Moves to a step. A step's fields are gone once it is left, so they are checked
   * first, either way: nothing wrong can be left behind where it cannot be seen.
   */
  function goTo(to: number) {
    if (to === step) return;
    if (form.current && !reportInvalid(form.current)) return;
    if (to > step && canGoForward && !canGoForward(step)) return;
    show(to);
  }

  return { form, step, forward, isLast: step === count - 1, goTo, show };
}

/** Where the steps are up to. */
export function FormSteps({
  labels,
  current,
  onPick,
}: {
  labels: readonly string[];
  current: number;
  onPick?: (step: number) => void;
}) {
  return (
    <ol
      data-slot="form-steps"
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
      aria-label="Steps"
    >
      {labels.map((label, i) => {
        const content = (
          <>
            <span
              className={cn('block h-1 rounded-full', i <= current ? 'bg-primary' : 'bg-muted')}
            />
            <span
              className={cn(
                'block truncate text-xs',
                i === current ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              {i + 1}. {label}
            </span>
          </>
        );
        return (
          <li key={label} aria-current={i === current ? 'step' : undefined} className="space-y-1.5">
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(i)}
                className="focus-visible:ring-ring touch:min-h-11 block w-full space-y-1.5 rounded-sm text-left outline-none focus-visible:ring-2"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The current step's fields. Opening the form reveals them with the rest of the form's fields
 * (the form rules in styles.css); moving to another step slides them in from the side the
 * steps moved towards.
 */
export function FormStep({
  step,
  forward,
  className,
  children,
}: {
  step: number;
  forward: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  // Adjusting state during render, so the slide applies to the very first paint of a new step.
  const [shownStep, setShownStep] = useState(step);
  const [moved, setMoved] = useState(false);
  if (step !== shownStep) {
    setShownStep(step);
    setMoved(true);
  }
  return (
    <div
      key={step}
      data-moved={moved || undefined}
      className={cn(
        moved && 'animate-in fade-in duration-200 ease-out motion-reduce:animate-none',
        moved && (forward ? 'slide-in-from-right-3' : 'slide-in-from-left-3'),
        className
      )}
    >
      {children}
    </div>
  );
}
