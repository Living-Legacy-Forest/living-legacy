import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ArrowForwardIcon, CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type ActionState = 'idle' | 'pending' | 'success';

type ActionButtonProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'loading' | 'children'> & {
  label: string;
  pendingLabel?: string;
  successLabel?: string;
  /**
   * The work to do. Resolving shows the success state; throwing or resolving to `false` goes
   * straight back to the label. `useAction().run` reports failure by returning `undefined`, so
   * pass `() => run(…).then((result) => result !== undefined)` when the action returns a value.
   */
  onAction: () => Promise<unknown>;
  /** How long the success state shows before the label comes back. 0 keeps it. */
  resetAfterMs?: number;
  /** Shown after the label while idle. */
  icon?: ReactNode;
};

/**
 * A button that runs one action and says how it went in place: the label gives way to
 * "Saving…" with a spinner, then "Saved" with a tick that draws itself, then returns.
 * Button eases the width between labels; this only keeps the state.
 */
function ActionButton({
  label,
  pendingLabel = 'Saving…',
  successLabel = 'Saved',
  onAction,
  resetAfterMs = 2400,
  icon = <ArrowForwardIcon aria-hidden />,
  disabled,
  focusableWhenDisabled,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<ActionState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function run() {
    if (state === 'pending') return;
    clearTimeout(resetTimer.current);
    setState('pending');
    let ok: boolean;
    try {
      ok = (await onAction()) !== false;
    } catch {
      ok = false;
    }
    if (!ok) return setState('idle');
    setState('success');
    if (resetAfterMs > 0) resetTimer.current = setTimeout(() => setState('idle'), resetAfterMs);
  }

  const pending = state === 'pending';
  const text = pending ? pendingLabel : state === 'success' ? successLabel : label;

  return (
    <Button
      type="button"
      {...props}
      // Pending ignores presses but keeps focus, so a keyboard user is not dropped mid-save.
      disabled={disabled || pending}
      focusableWhenDisabled={focusableWhenDisabled || pending}
      aria-busy={pending || undefined}
      data-state={state}
      // One name throughout; the progress is announced by the status region instead.
      aria-label={label}
      onClick={run}
    >
      <span aria-hidden className="contents">
        {text}
        {/* A fixed slot, so swapping icons never changes the width; only the words do. */}
        <span data-icon="inline-end" className="inline-grid size-4 place-items-center">
          {pending ? (
            <Spinner role={undefined} aria-label={undefined} />
          ) : state === 'success' ? (
            <CheckIcon className="[&_path]:[stroke-dasharray:1] motion-safe:[&_path]:animate-[drawn-check-draw_300ms_cubic-bezier(0.16,1,0.3,1)_50ms_backwards]" />
          ) : (
            icon
          )}
        </span>
      </span>
      <span role="status" className="sr-only">
        {pending ? pendingLabel : state === 'success' ? successLabel : ''}
      </span>
    </Button>
  );
}

export { ActionButton };
