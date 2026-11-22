'use client';

// iOS's switch, after HextaUI's (hextaui.com/docs/switch, MIT): a capsule thumb
// on a wider track that turns green when on, stretches while pressed and can be
// dragged across. Ported rather than installed, so it uses this app's tokens.
import * as React from 'react';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { type VariantProps, cva } from 'class-variance-authority';
import { play } from '@/lib/sound';
import { cn } from '@/lib/utils';

const switchVariants = cva(
  [
    'group/switch peer relative inline-flex h-(--switch-h) touch-pan-y w-(--switch-w) shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none select-none',
    'transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
    // The thumb's travel: --switch-x, mirrored right to left, shortened by the press stretch.
    '[--switch-dir:1] [--switch-stretch:0px] [--switch-thumb-w:var(--switch-thumb)] [--switch-x:0px] rtl:[--switch-dir:-1]',
    'data-checked:[--switch-x:calc(var(--switch-w)-var(--switch-thumb-w)-4px-var(--switch-stretch))] data-dragging:[--switch-x:var(--switch-drag)]',
    '[&:active:not([data-disabled]):not([data-readonly])]:[--switch-stretch:4px]',
    // A bigger target than the track, more so for a finger.
    'after:absolute after:-inset-1.5 pointer-coarse:after:-inset-3',
    'focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 focus-visible:ring-3',
    'data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:cursor-default forced-colors:border forced-colors:data-checked:bg-[Highlight]',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-foreground/20 data-checked:bg-primary data-[drag=off]:bg-foreground/20 data-[drag=on]:bg-primary dark:bg-foreground/25 dark:data-[drag=off]:bg-foreground/25',
        // iOS: a light track with a hairline edge, a wider thumb, and system green when on.
        ios: 'bg-foreground/10 inset-ring-[0.5px] inset-ring-foreground/3 [--switch-on:#34c759] [--switch-thumb-w:calc(var(--switch-thumb)*1.5)] data-checked:bg-(--switch-on) data-checked:inset-ring-transparent data-[drag=off]:bg-foreground/10 data-[drag=on]:bg-(--switch-on) dark:bg-foreground/20 dark:[--switch-on:#30d158] dark:data-[drag=off]:bg-foreground/20',
      },
      size: {
        sm: '[--switch-h:1rem] [--switch-thumb:0.75rem] [--switch-w:1.75rem]',
        default: '[--switch-h:1.25rem] [--switch-thumb:1rem] [--switch-w:2.25rem]',
        lg: '[--switch-h:1.5rem] [--switch-thumb:1.25rem] [--switch-w:2.75rem]',
      },
    },
    compoundVariants: [
      {
        variant: 'ios',
        size: 'sm',
        className: '[--switch-h:1.5rem] [--switch-thumb:1.25rem] [--switch-w:3.5rem]',
      },
      {
        variant: 'ios',
        size: 'default',
        // iOS size for a finger; a little smaller where there is a mouse.
        className:
          '[--switch-h:1.75rem] [--switch-thumb:1.5rem] [--switch-w:4rem] pointer-fine:[--switch-h:1.5rem] pointer-fine:[--switch-thumb:1.25rem] pointer-fine:[--switch-w:3.25rem]',
      },
      {
        variant: 'ios',
        size: 'lg',
        className: '[--switch-h:2rem] [--switch-thumb:1.75rem] [--switch-w:4.5rem]',
      },
    ],
    defaultVariants: { variant: 'ios', size: 'default' },
  }
);

/**
 * Drag the thumb across to switch. A drag past halfway switches on release,
 * through a click so Base UI's own state and events stay in charge.
 */
function useThumbDrag(rootRef: React.RefObject<HTMLElement | null>, canDrag: () => boolean) {
  const drag = React.useRef<{
    id: number;
    startX: number;
    from: boolean;
    max: number;
    moved: boolean;
    position: number;
  } | null>(null);
  const suppressClick = React.useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!root || event.button !== 0 || !canDrag()) return;
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      from: root.hasAttribute('data-checked'),
      max: 0,
      moved: false,
      position: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const root = rootRef.current;
    if (!state || !root || event.pointerId !== state.id) return;
    const rtl = getComputedStyle(root).direction === 'rtl';
    const delta = (event.clientX - state.startX) * (rtl ? -1 : 1);
    if (!state.moved && Math.abs(delta) < 3) return;
    if (!state.moved) {
      const thumb = root.querySelector<HTMLElement>('[data-slot=switch-thumb]');
      state.max = Math.max(0, root.clientWidth - (thumb?.offsetWidth ?? 0) - 4);
      state.moved = true;
      root.setPointerCapture?.(event.pointerId);
      root.setAttribute('data-dragging', '');
    }
    state.position = Math.min(state.max, Math.max(0, (state.from ? state.max : 0) + delta));
    root.setAttribute('data-drag', state.position > state.max / 2 ? 'on' : 'off');
    root.style.setProperty('--switch-drag', `${state.position}px`);
  };

  const finish = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    const root = rootRef.current;
    drag.current = null;
    if (!state || !root || !state.moved) return;
    root.removeAttribute('data-dragging');
    root.removeAttribute('data-drag');
    root.style.removeProperty('--switch-drag');
    if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
    const toggle = state.position > state.max / 2 !== state.from && event.type === 'pointerup';
    // The drag's own click is swallowed; a real change is replayed as a click.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
      if (toggle) root.click();
    }, 0);
  };

  const onClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onClickCapture,
  };
}

function Switch({
  className,
  variant = 'ios',
  size = 'default',
  disabled,
  readOnly,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClickCapture,
  onCheckedChange,
  ref,
  ...props
}: SwitchPrimitive.Root.Props & VariantProps<typeof switchVariants>) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const drag = useThumbDrag(rootRef, () => !disabled && !readOnly);

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  return (
    <SwitchPrimitive.Root
      ref={setRef}
      disabled={disabled}
      readOnly={readOnly}
      data-slot="switch"
      data-size={size}
      data-variant={variant}
      className={cn(switchVariants({ variant, size }), className as string)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) drag.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        drag.onPointerMove(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        drag.onPointerUp(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        drag.onPointerCancel(event);
      }}
      onClickCapture={(event) => {
        onClickCapture?.(event);
        drag.onClickCapture(event);
      }}
      onCheckedChange={(checked, details) => {
        play(checked ? 'on' : 'off');
        onCheckedChange?.(checked, details);
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background ring-foreground/3 dark:bg-foreground dark:group-data-[variant=default]/switch:group-data-checked/switch:bg-primary-foreground pointer-events-none relative z-1 h-(--switch-thumb) w-[calc(var(--switch-thumb-w)+var(--switch-stretch))] translate-x-[calc(var(--switch-x)*var(--switch-dir))] rounded-full shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] ring-[0.5px] transition-[translate,width] duration-300 ease-[cubic-bezier(0.34,1.36,0.64,1)] group-data-dragging/switch:transition-none motion-reduce:transition-none forced-colors:border"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchVariants };
