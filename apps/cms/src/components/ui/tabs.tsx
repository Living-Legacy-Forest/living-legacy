import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

function Tabs({
  className,
  orientation = 'horizontal',
  onValueChange,
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      onValueChange={onValueChange}
      data-orientation={orientation}
      className={cn(
        'group/tabs flex min-w-0 gap-2 data-horizontal:max-w-full data-horizontal:flex-col',
        className
      )}
      {...props}
    />
  );
}

// `isolate` gives the list its own stacking context, so the highlight passes under every label.
const tabsListVariants = cva(
  'group/tabs-list relative isolate inline-flex w-max items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'gap-0.5 bg-transparent p-0 group-data-horizontal/tabs:h-auto',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/** How far a tab must sit from an edge with an arrow over it to count as in view. */
const ARROW_WIDTH = 32;

/**
 * Scrolls sideways when the tabs are wider than the space they have, with faded edges and
 * arrows, and keeps the active tab in view as it changes from a click, a key or the code.
 */
function useTabsOverflow() {
  const shell = React.useRef<HTMLDivElement>(null);
  const viewport = React.useRef<HTMLDivElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ overflow: false, left: false, right: false });

  const smooth = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

  const measure = React.useCallback(() => {
    const frame = shell.current;
    const scroll = viewport.current;
    const content = list.current;
    if (!frame || !scroll || !content) return;
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const next = {
      overflow: content.offsetWidth > frame.clientWidth + 1,
      left: scroll.scrollLeft > 1,
      right: scroll.scrollLeft < max - 1,
    };
    setEdges((previous) =>
      previous.overflow === next.overflow &&
      previous.left === next.left &&
      previous.right === next.right
        ? previous
        : next
    );
  }, []);

  const reveal = React.useCallback((tab: Element | null) => {
    const scroll = viewport.current;
    if (!scroll || !tab || scroll.scrollWidth <= scroll.clientWidth) return;
    const frame = scroll.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    const max = scroll.scrollWidth - scroll.clientWidth;
    const left = frame.left + (scroll.scrollLeft > 1 ? ARROW_WIDTH : 0);
    const right = frame.right - (scroll.scrollLeft < max - 1 ? ARROW_WIDTH : 0);
    const delta = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
    if (delta) scroll.scrollBy({ left: delta, behavior: smooth() });
  }, []);

  React.useLayoutEffect(() => {
    const frame = shell.current;
    const scroll = viewport.current;
    const content = list.current;
    if (!frame || !scroll || !content) return;
    const resize = new ResizeObserver(measure);
    resize.observe(frame);
    resize.observe(content);
    // The list marks the active tab itself, so watching that attribute catches every change.
    const active = new MutationObserver(() => reveal(content.querySelector('[data-active]')));
    active.observe(content, { subtree: true, attributeFilter: ['data-active'] });
    scroll.addEventListener('scroll', measure, { passive: true });
    measure();
    reveal(content.querySelector('[data-active]'));
    return () => {
      resize.disconnect();
      active.disconnect();
      scroll.removeEventListener('scroll', measure);
    };
  }, [measure, reveal]);

  const page = (direction: -1 | 1) =>
    viewport.current?.scrollBy({
      left: direction * viewport.current.clientWidth * 0.75,
      behavior: smooth(),
    });

  return { shell, viewport, list, edges, reveal, page };
}

const scrollButtonClass =
  'absolute inset-y-0 z-10 grid w-8 place-items-center text-foreground outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-0 group-data-[variant=default]/tabs-shell:bg-background [&_svg]:size-4';

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const { shell, viewport, list, edges, reveal, page } = useTabsOverflow();
  return (
    <div
      ref={shell}
      data-slot="tabs-list-shell"
      data-variant={variant}
      data-overflow={edges.overflow || undefined}
      className="group/tabs-shell relative inline-flex max-w-full min-w-0 group-data-vertical/tabs:flex-col data-[variant=default]:rounded-md"
    >
      {edges.overflow && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Scroll tabs left"
          disabled={!edges.left}
          onClick={() => page(-1)}
          className={cn(scrollButtonClass, 'left-0 rounded-l-lg')}
        >
          <ChevronLeftIcon aria-hidden />
        </button>
      )}
      {/* Only clips while it scrolls, so the line variant's underline can still hang over the
          border below it. */}
      <div
        ref={viewport}
        data-left={edges.left || undefined}
        data-right={edges.right || undefined}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement && event.target.getAttribute('role') === 'tab')
            reveal(event.target);
        }}
        className={cn(
          'min-w-0 rounded-[inherit]',
          edges.overflow &&
            '[scrollbar-width:none] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden',
          '[--fade:2rem] data-left:mask-[linear-gradient(to_right,transparent,black_var(--fade),black)] data-right:mask-[linear-gradient(to_right,black,black_calc(100%-var(--fade)),transparent)] data-left:data-right:mask-[linear-gradient(to_right,transparent,black_var(--fade),black_calc(100%-var(--fade)),transparent)]'
        )}
      >
        <TabsPrimitive.List
          ref={list}
          data-slot="tabs-list"
          data-variant={variant}
          className={cn(tabsListVariants({ variant }), className)}
          {...props}
        >
          {children}
          <TabsIndicator />
        </TabsPrimitive.List>
      </div>
      {edges.overflow && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Scroll tabs right"
          disabled={!edges.right}
          onClick={() => page(1)}
          className={cn(scrollButtonClass, 'right-0 rounded-r-lg')}
        >
          <ChevronRightIcon aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * One highlight for the whole list that glides to the active tab, instead of a fill that
 * blinks from one tab to the next. Base UI measures the active tab into the CSS variables.
 */
function TabsIndicator() {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        'pointer-events-none absolute top-0 left-0 -z-10 translate-x-(--active-tab-left) transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        // Default: a soft fill under the active tab, as in the pill rows.
        'group-data-[variant=default]/tabs-list:bg-muted group-data-[variant=default]/tabs-list:h-(--active-tab-height) group-data-[variant=default]/tabs-list:w-(--active-tab-width) group-data-[variant=default]/tabs-list:translate-y-(--active-tab-top) group-data-[variant=default]/tabs-list:rounded-md',
        // Line: a bar that slides along the bottom edge, or down the right edge when vertical.
        'group-data-[variant=line]/tabs-list:bg-foreground group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:top-auto group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:-bottom-px group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:h-0.5 group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:w-(--active-tab-width) group-data-vertical/tabs:group-data-[variant=line]/tabs-list:right-0 group-data-vertical/tabs:group-data-[variant=line]/tabs-list:left-auto group-data-vertical/tabs:group-data-[variant=line]/tabs-list:h-(--active-tab-height) group-data-vertical/tabs:group-data-[variant=line]/tabs-list:w-0.5 group-data-vertical/tabs:group-data-[variant=line]/tabs-list:translate-x-0 group-data-vertical/tabs:group-data-[variant=line]/tabs-list:translate-y-(--active-tab-top)'
      )}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground active:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 [-webkit-tap-highlight-color:transparent] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'pointer-fine:hover:text-foreground data-active:text-foreground dark:data-active:text-foreground',
        // Default: the same items as the pill rows (`components/ui/pill-track`).
        'group-data-[variant=default]/tabs-list:text-muted-foreground group-data-[variant=default]/tabs-list:text-ui group-data-[variant=default]/tabs-list:h-7 group-data-[variant=default]/tabs-list:flex-none group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border-0 group-data-[variant=default]/tabs-list:px-2.5 group-data-[variant=default]/tabs-list:font-normal group-data-[variant=default]/tabs-list:data-active:font-medium',
        className
      )}
      {...props}
    />
  );
}

/**
 * The new panel fades in and drifts a few pixels from the side of the tab it came from; the
 * old one leaves at once so the two never stack. Still for reduced motion, apart from the fade.
 */
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        'flex-1 text-sm outline-none',
        'transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:duration-0',
        'data-[activation-direction=down]:data-starting-style:translate-y-2 data-[activation-direction=left]:data-starting-style:-translate-x-2 data-[activation-direction=right]:data-starting-style:translate-x-2 data-[activation-direction=up]:data-starting-style:-translate-y-2',
        'data-[activation-direction=down]:data-starting-style:opacity-0 data-[activation-direction=left]:data-starting-style:opacity-0 data-[activation-direction=right]:data-starting-style:opacity-0 data-[activation-direction=up]:data-starting-style:opacity-0',
        'motion-reduce:translate-none',
        className
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
