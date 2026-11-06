import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Shows or hides its children with a short height and fade, then takes them
 * off the page once closed. Animating the grid row from 0fr to 1fr follows the
 * content's real height, so nothing needs measuring. Instant for people who
 * ask for reduced motion.
 */
export function Reveal({
  show,
  children,
  className,
}: {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show);
  // Clipped only while moving, so focus rings and shadows show once it has opened.
  const [settled, setSettled] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      if (reducedMotion()) {
        setOpen(true);
        setSettled(true);
        return;
      }
      // Two frames: the closed state has to paint before the open one can animate.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setSettled(false);
    setOpen(false);
    if (reducedMotion()) setMounted(false);
  }, [show]);

  if (!mounted) return null;
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || e.propertyName !== 'grid-template-rows') return;
        if (open) setSettled(true);
        else setMounted(false);
      }}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className
      )}
    >
      <div className={cn('min-h-0', !settled && 'overflow-hidden')}>{children}</div>
    </div>
  );
}
