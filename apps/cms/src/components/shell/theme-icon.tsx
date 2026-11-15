import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/icons';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { motionTokens } from '@/components/arc/lib/motion-tokens';

/** Rotation and scale ride the spring; opacity and blur tween so the blur never overshoots below zero. */
const tween = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] };
const iconSpring = { ...motionTokens.spring.snappy, opacity: tween, filter: tween } as const;
const iconExit = {
  duration: motionTokens.duration.fast,
  ease: [...motionTokens.ease.standard],
} as const;
const blur = `blur(${motionTokens.blur.subtle}px)`;

/**
 * A stored preference usually reaches the theme just after hydration. That correction swaps the
 * icon in place; only changes after the first painted frames animate, so a page that loads in
 * dark mode never spins its icon.
 */
function useSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return settled;
}

/** Both icons turn the same way (clockwise into dark, back out of it), so the swap reads as one rotation. */
export function ThemeIcon({ theme, className }: { theme: 'light' | 'dark'; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  const settled = useSettled();
  const Icon = theme === 'light' ? SunIcon : MoonIcon;
  const angle = theme === 'light' ? 30 : -30;
  const hidden = { opacity: 0, scale: 0.7, rotate: angle, filter: blur };
  return (
    <span
      className={`relative inline-grid size-4 shrink-0 place-items-center ${className ?? ''}`}
      aria-hidden
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={theme}
          className="col-start-1 row-start-1 inline-flex"
          initial={!settled ? false : reduced ? { opacity: 0 } : hidden}
          animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
          exit={
            !settled
              ? { opacity: 0, transition: { duration: 0 } }
              : reduced
                ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
                : { ...hidden, transition: iconExit }
          }
          transition={reduced ? { duration: motionTokens.duration.instant } : iconSpring}
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The theme on screen now; "match my device" resolves to what the device shows. */
export function useShowingTheme(): 'light' | 'dark' {
  const { effective } = useThemeChoice();
  if (effective !== 'system') return effective;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** One stable component, so the icon swap animates instead of remounting. */
export function CurrentThemeIcon({ className }: { className?: string }) {
  return <ThemeIcon theme={useShowingTheme()} className={className} />;
}
