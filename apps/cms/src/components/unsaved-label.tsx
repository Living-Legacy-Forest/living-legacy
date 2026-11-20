import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { enterTransition, exitTransition } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * A short "Unsaved changes" note that eases in and out with the form's dirty state.
 * Its width grows from nothing, so neighbours in the same row glide over instead of jumping.
 * `gap` is the row's flex gap in px: it is taken back while the note is hidden, so that too
 * eases rather than snapping. Leave it 0 for inline text.
 */
export function UnsavedLabel({
  show,
  gap = 0,
  className,
  children = 'Unsaved changes',
}: {
  show: boolean;
  gap?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const hidden = { width: 0, opacity: 0, x: -4, marginRight: -gap };
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key="unsaved"
          className={cn('block overflow-hidden whitespace-nowrap', className)}
          aria-live="polite"
          initial={reduce ? false : hidden}
          animate={{ width: 'auto', opacity: 1, x: 0, marginRight: 0 }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : { ...hidden, transition: exitTransition }
          }
          transition={enterTransition}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
