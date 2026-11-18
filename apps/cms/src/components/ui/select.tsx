'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from '@/components/icons';
import { GlideHighlight } from '@/components/ui/glide-highlight';

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  );
}

/**
 * A newly chosen value rises into place instead of swapping. It watches the text, so it runs
 * whatever changed the value, and not on first paint.
 */
function useValueRise() {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let shown = node.textContent;
    const observer = new MutationObserver(() => {
      if (node.textContent === shown) return;
      shown = node.textContent;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.animate(
        reduced
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: 'translateY(0.35em)' },
              { opacity: 1, transform: 'none' },
            ],
        { duration: reduced ? 100 : 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    });
    observer.observe(node, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return ref;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  const ref = useValueRise();
  return (
    <SelectPrimitive.Value
      ref={ref}
      data-slot="select-value"
      className={cn('flex flex-1 text-left', className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default';
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "group/select-trigger border-input focus-visible:border-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/25 md:text-ui touch:data-[size=default]:h-11 touch:data-[size=sm]:h-11 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-base whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-8 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          // Flips while the list is open.
          <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-popup-open/select-trigger:rotate-180 motion-reduce:transition-none" />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  // Phones: a menu below the value, its right edge on the value's, as iOS's pull-down menus.
  // A long list becomes a sheet from the bottom of the screen instead (styles.css, select-positioner).
  const phone = useIsMobile();
  if (phone) {
    align = 'end';
    alignItemWithTrigger = false;
  }
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        data-slot="select-positioner"
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'bg-popover text-popover-foreground ring-foreground/6 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg shadow-md ring-1 max-md:min-w-60 max-md:rounded-xl',
            // Grows from the trigger, as dropdown menus do. Laid over the trigger (aligned to the
            // chosen item) there is no side, so it only fades and scales.
            'transition-[opacity,scale,translate] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-opacity',
            'data-starting-style:scale-97 data-starting-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=top]:data-starting-style:translate-y-1',
            'data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100 data-ending-style:ease-[cubic-bezier(0.22,1,0.36,1)]',
            className
          )}
          {...props}
        >
          <GlideHighlight />
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('text-muted-foreground px-1.5 py-1 text-xs', className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground text-ui touch:min-h-11 relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 max-md:text-[1.0625rem] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          // The tick pops in on the chosen option.
          <span className="animate-in fade-in-0 zoom-in-75 pointer-events-none absolute right-2 flex size-4 items-center justify-center duration-200 motion-reduce:animate-none" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "bg-popover top-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bg-popover bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
