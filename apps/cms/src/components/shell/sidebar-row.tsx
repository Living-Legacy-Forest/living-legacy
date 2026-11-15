import type { ReactElement, ReactNode } from 'react';
import type { LucideIcon } from '@/components/icons';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { navItemClass } from './nav-styles';

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
      <span className="min-w-0 flex-1 truncate">{label}</span>
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
