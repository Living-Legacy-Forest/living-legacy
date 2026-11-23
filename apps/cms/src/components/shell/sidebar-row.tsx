import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';
import type { LucideIcon } from '@/components/icons';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motionTokens } from '@/components/arc/lib/motion-tokens';
import { navItemClass } from './nav-styles';

/**
 * A name that slides up out of the way when it changes ("Switch to dark" to "Switch to light"),
 * with the new one rising in behind it. The first paint never animates, and reduced motion
 * fades instead of moving.
 */
function RowLabel({ label }: { label: string }) {
  const reduced = useReducedMotion() ?? false;
  const offset = reduced ? 0 : 10;
  return (
    <span className="relative min-w-0 flex-1 overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={label}
          className="block truncate"
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -offset }}
          transition={{
            y: motionTokens.spring.snappy,
            opacity: {
              duration: motionTokens.duration.fast,
              ease: [...motionTokens.ease.standard],
            },
          }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * One row of the sidebar: its icon, then its name. The name is always there, clipped by the
 * column's width, so it slides into view as a column widens and screen readers always hear it.
 * While its column shows only icons, hovering or focusing the row names it beside.
 */
export function SidebarRow({
  icon: Icon,
  label,
  wide,
  active = false,
  render,
  onClick,
  trailing,
  className,
}: {
  icon: LucideIcon;
  label: string;
  /** The column shows names. */
  wide: boolean;
  active?: boolean;
  /** The element the row is, such as a Link; a button without one. */
  render?: ReactElement;
  onClick?: () => void;
  /** After the name: a shortcut, a dot. */
  trailing?: ReactNode;
  className?: string;
}) {
  const row = (
    <SidebarMenuButton
      isActive={active}
      render={render}
      onClick={onClick}
      className={cn(navItemClass, 'h-8 gap-3 px-2.5', className)}
    >
      <Icon aria-hidden className="shrink-0" />
      <RowLabel label={label} />
      {trailing}
    </SidebarMenuButton>
  );
  if (wide) return row;
  return (
    <Tooltip>
      <TooltipTrigger delay={300} render={row} />
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
