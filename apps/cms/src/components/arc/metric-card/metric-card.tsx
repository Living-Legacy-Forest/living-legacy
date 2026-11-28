'use client';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useState } from 'react';
import { motionTokens } from '@/components/arc/lib/motion-tokens';
import { RollingNumber } from '@/components/rolling-number';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Ported from uiarc's metric card: our Card for the surface and our RollingNumber for the
// figure (the library's counter and CSS module are not installed, see the usage meter port).

export interface MetricCardProps {
  label: string;
  value: number;
  /** Digits after the decimal point. */
  decimals?: number;
  /** Text after the figure, such as "%" or " ms". */
  suffix?: string;
  /** A line under the figure saying what it counts. */
  context: string;
  /** How the figure moved, such as "+4.2%"; a + or - leads it into green or red. */
  change?: string;
  /** A rise is bad news (incidents, response time): + shows red and - green. */
  lowerIsBetter?: boolean;
  /** No figure to show yet: a dash stands in for it. */
  empty?: boolean;
  className?: string;
}

/** Copy that holds a number enters from the side it moved toward: larger rises, smaller drops. */
const rise: Variants = {
  hidden: (direction: number) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.soft}px)`,
  }),
  shown: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] },
  },
  gone: (direction: number) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: motionTokens.duration.instant } },
  gone: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
};

const amountIn = (text: string) =>
  Number(text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);

/** New copy rises in while the old copy leaves, so a changed line never just snaps. */
function Swap({ text }: { text: string }) {
  const reduced = !!useReducedMotion();
  const [shown, setShown] = useState({ text, direction: 1 });
  if (shown.text !== text) {
    setShown({ text, direction: amountIn(text) < amountIn(shown.text) ? -1 : 1 });
  }
  return (
    <span className="relative block max-w-full">
      <AnimatePresence mode="popLayout" initial={false} custom={shown.direction}>
        <motion.span
          key={text}
          className="block"
          custom={shown.direction}
          variants={reduced ? fade : rise}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function MetricCard({
  label,
  value,
  decimals = 0,
  suffix,
  context,
  change,
  lowerIsBetter = false,
  empty = false,
  className,
}: MetricCardProps) {
  const sign = change ? (/^\+/.test(change) ? 'up' : /^[-−]/.test(change) ? 'down' : null) : null;
  // Green is good news: a fall in something where lower is better counts as up.
  const trend = sign && (lowerIsBetter ? (sign === 'up' ? 'down' : 'up') : sign);
  return (
    <Card className={cn('gap-0', className)}>
      <div className="flex items-center justify-between gap-3 px-(--card-spacing)">
        <span className="text-muted-foreground min-w-0 truncate text-sm">
          <Swap text={label} />
        </span>
        {change && (
          <small
            className={cn(
              'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums',
              trend === 'up' && 'bg-success/10 text-success-text border-transparent',
              trend === 'down' && 'bg-destructive/10 text-destructive border-transparent',
              !trend && 'text-muted-foreground'
            )}
          >
            {change}
          </small>
        )}
      </div>
      <p className="mt-3 px-(--card-spacing) text-3xl font-medium tracking-tight tabular-nums">
        {empty ? (
          '–'
        ) : (
          <>
            <RollingNumber value={value} decimals={decimals} />
            {suffix}
          </>
        )}
      </p>
      <p className="text-muted-foreground mt-1.5 px-(--card-spacing) text-xs">
        <Swap text={context} />
      </p>
    </Card>
  );
}
