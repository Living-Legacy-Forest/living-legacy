import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { isValidElement, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // On touch screens an invisible ::after stretches the tap area to 44pt (32px + 6px above and
  // below), so the button keeps its 32px look. Only vertical, as touch-hit (styles.css), so
  // buttons side by side never take each other's taps.
  // The press shrinks the button a touch (icons a touch more, via --btn-press). Buttons that
  // open a menu, popover or dialog stay still: the layer would measure a shrunken anchor.
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none select-none [--btn-press:0.97] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:not-aria-[haspopup]:not-data-[popup-open]:scale-(--btn-press) active:duration-100 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 touch:after:absolute touch:after:inset-x-0 touch:after:-inset-y-1.5",
  {
    variants: {
      variant: {
        // Raised look: a top-lit gradient, a one-pixel highlight along the top edge and a
        // darker rim, all mixed from --primary so it follows the theme and dark mode.
        default:
          '[--btn-edge:color-mix(in_oklch,var(--primary),black_10%)] [--btn-hi:color-mix(in_oklch,var(--primary),white_30%)] [--btn-top:color-mix(in_oklch,var(--primary),white_15%)] border-(--btn-edge) bg-primary bg-linear-to-b from-(--btn-top) to-primary text-primary-foreground shadow-[inset_0_1px_0_0_var(--btn-hi),0_1px_2px_0_rgb(0_0_0/0.05)] hover:from-(--btn-hi) active:from-primary',
        // The active states repeat hover so a tap on a touch screen, where hover never fires, still answers.
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 dark:active:bg-input/50',
        // In light mode --secondary is nearly the page colour, so the fill is darkened a step to
        // show as a button; dark mode's --secondary already stands off the surface.
        secondary:
          'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)] active:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_13%)] aria-expanded:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)] aria-expanded:text-secondary-foreground dark:bg-secondary dark:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] dark:active:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] dark:aria-expanded:bg-secondary',
        ghost:
          'hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:active:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:active:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline [--btn-press:1]',
      },
      size: {
        default:
          'touch:h-9 touch:after:-inset-y-[5px] h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        xs: "touch:after:-inset-y-2.5 h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "touch:h-9 touch:after:-inset-y-[5px] h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-ui-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        icon: 'touch:size-9 touch:after:-inset-y-[5px] size-8 [--btn-press:0.96]',
        'icon-xs':
          "touch:after:-inset-y-2.5 size-6 rounded-[min(var(--radius-md),10px)] [--btn-press:0.96] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'touch:size-9 touch:after:-inset-y-[5px] size-8 rounded-[min(var(--radius-md),12px)] [--btn-press:0.96] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-10 [--btn-press:0.96]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const easeOut = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** The width before any press scale, unrounded, so the animation ends exactly where layout does. */
const layoutWidth = (element: HTMLElement) => parseFloat(getComputedStyle(element).width);

/** Text plus element names, so a new label or icon counts as a change and a re-render with the same label does not. */
function labelKey(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint')
    return String(node);
  if (Array.isArray(node)) return node.map(labelKey).join('');
  if (!isValidElement(node)) return '';
  const type = node.type as string | { displayName?: string; name?: string };
  const name = typeof type === 'string' ? type : (type?.displayName ?? type?.name ?? '');
  return `<${name}>${labelKey((node.props as { children?: ReactNode }).children)}`;
}

/**
 * When the label changes ("Save" to "Saving…"), the button eases to its new width and the new
 * label fades up into place, instead of the button snapping to a new size. Nothing runs on
 * other re-renders, so the cost is a string compare. The old width is read during render, the
 * last moment it is still on screen; it only happens on the render where the label changed.
 */
function useLabelMorph(children: ReactNode) {
  const buttonRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const key = labelKey(children);
  const shownKey = useRef(key);
  const fromWidth = useRef<number | null>(null);

  if (key !== shownKey.current && fromWidth.current === null && buttonRef.current) {
    fromWidth.current = layoutWidth(buttonRef.current);
  }

  useLayoutEffect(() => {
    if (key === shownKey.current) return;
    shownKey.current = key;
    const button = buttonRef.current;
    const label = labelRef.current;
    const from = fromWidth.current;
    fromWidth.current = null;
    if (!button || !label) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const iconOnly = !/\S/.test(key.replace(/<[^>]*>/g, ''));
    label.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : iconOnly
          ? [
              { opacity: 0, transform: 'scale(0.85)' },
              { opacity: 1, transform: 'none' },
            ]
          : [
              { opacity: 0, transform: 'translateY(2px)' },
              { opacity: 1, transform: 'none' },
            ],
      { duration: reduced ? 100 : 200, easing: easeOut }
    );

    const to = layoutWidth(button);
    if (reduced || from === null || Math.abs(to - from) < 1) return;
    const width = button.animate([{ width: `${from}px` }, { width: `${to}px` }], {
      duration: 300,
      easing: easeOut,
    });
    // A longer label would spill past the edge while the width catches up.
    button.style.overflow = 'clip';
    width.finished.then(
      () => button.style.removeProperty('overflow'),
      () => button.style.removeProperty('overflow')
    );
  }, [key]);

  return { buttonRef, labelRef };
}

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner over the label and ignores presses, keeping focus and the button's width. */
    loading?: boolean;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  disabled,
  focusableWhenDisabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  const { buttonRef, labelRef } = useLabelMorph(children);
  const setRef = (node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      // Loading counts as disabled but stays focusable, so keyboard focus is not lost mid-save.
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled || loading}
      aria-busy={loading || undefined}
      ref={setRef}
      {...props}
    >
      {loading ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Spinner aria-hidden role={undefined} aria-label={undefined} />
        </span>
      ) : null}
      {/* Takes the button's own spacing and alignment, so layouts like justify-between still work. */}
      <span
        ref={labelRef}
        data-slot="button-label"
        className={cn(
          'inline-flex min-w-0 flex-1 items-center [justify-content:inherit] [gap:inherit]',
          loading && 'invisible'
        )}
      >
        {children}
      </span>
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
