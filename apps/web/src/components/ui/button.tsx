import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Softly rounded buttons on the golden type scale. Press feedback is a small
// scale rather than a nudge down, and only the properties that change transition.
const buttonClasses = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap outline-none select-none transition-[transform,background-color,border-color,color] duration-160 ease-[var(--ease-grow)] focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg[data-icon=inline-end]]:transition-transform [&_svg[data-icon=inline-end]]:duration-200 hover:[&_svg[data-icon=inline-end]]:translate-x-0.5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-moss-deep',
        outline:
          'border-input bg-transparent text-foreground hover:border-moss hover:text-moss-deep aria-expanded:border-moss',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-sun/40',
        ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20',
        link: 'h-auto rounded-none px-0 text-foreground underline decoration-bark/40 underline-offset-4 hover:text-moss-deep hover:decoration-moss active:not-aria-[haspopup]:scale-100',
      },
      size: {
        default:
          'h-12 gap-3 px-7 has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6',
        xs: 'h-8 gap-1.5 px-3 text-xs',
        sm: 'h-10 gap-2 px-5',
        lg: 'h-14 gap-3 px-8 text-lg',
        icon: 'size-11',
        'icon-xs': "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * The button classes for a variant and size, merged. cva only concatenates,
 * so the base's `border-transparent` and outline's `border-input` would both
 * reach the page and the stylesheet order would pick the winner (transparent,
 * which hid every outline button's border). Merging here means a variant's
 * utilities always replace the base's, including for the .astro links that
 * call this directly rather than going through Button.
 */
function buttonVariants(props?: Parameters<typeof buttonClasses>[0]) {
  return cn(buttonClasses(props));
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonClasses>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
