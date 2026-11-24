import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePaneHost } from './list-page';

/** How long "Saved" shows before the button reads Save again. */
const SAVED_MS = 2400;

/**
 * How a list page's form says it saved. An edit in the pane stays on screen, so the Save button
 * says "Saved" where the person is looking, with no toast or sound: routine saves stay quiet. A
 * new item reopens as itself and the dialog closes, so those keep their toast.
 *
 *   const feedback = useSaveFeedback({ editing: item !== null, dirty });
 *   run(save, { success: feedback.toast({ title, description }), … });
 *   if (result) { feedback.saved(); onSaved(result.id); }
 *   <SaveButton pending={pending} saved={feedback.showSaved}>Save</SaveButton>
 */
export function useSaveFeedback({ editing, dirty }: { editing: boolean; dirty: boolean }) {
  const quiet = usePaneHost() === 'pane' && editing;
  const [showSaved, setShowSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Typing again means the form no longer matches what was saved.
  useEffect(() => {
    if (dirty) setShowSaved(false);
  }, [dirty]);

  const saved = useCallback(() => {
    if (!quiet) return;
    clearTimeout(timer.current);
    setShowSaved(true);
    timer.current = setTimeout(() => setShowSaved(false), SAVED_MS);
  }, [quiet]);

  return {
    showSaved,
    /** The success toast, or none when the button says it instead. */
    toast: <N,>(notice: N): N | undefined => (quiet ? undefined : notice),
    /** Call once the save has worked. */
    saved,
  };
}

/** A form's submit button: its label, then "Saving…", then briefly "Saved" with a tick. */
export function SaveButton({
  pending,
  saved = false,
  disabled,
  children,
}: {
  pending: boolean;
  saved?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending || disabled} data-state={saved ? 'saved' : undefined}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : saved ? (
        <>
          <CheckIcon
            aria-hidden
            data-icon="inline-start"
            className="[&_path]:[stroke-dasharray:1] motion-safe:[&_path]:animate-[drawn-check-draw_300ms_cubic-bezier(0.16,1,0.3,1)_50ms_backwards]"
          />
          Saved
        </>
      ) : (
        children
      )}
      <span role="status" className="sr-only">
        {saved ? 'Saved' : ''}
      </span>
    </Button>
  );
}
