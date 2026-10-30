import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonVariantProps = NonNullable<Parameters<typeof buttonVariants>[0]>;

export interface CtaProps {
  ctaEnabled: boolean;
  text: string;
  link: string;
  variant?: ButtonVariantProps['variant'];
  size?: ButtonVariantProps['size'];
  /** Optional trailing icon, nudged on hover like the site's other buttons. */
  iconEnd?: IconSvgElement;
}

/**
 * A hero call to action, styled as the site's pill button. In-page and
 * same-site links open in place; only absolute links to another site open a
 * new tab, and say so to screen readers.
 */
export function Cta({ cta, className }: Readonly<{ cta: CtaProps; className?: string }>) {
  if (!cta.ctaEnabled) return null;

  const external = /^https?:\/\//.test(cta.link);

  return (
    <a
      href={cta.link}
      className={cn(
        buttonVariants({ variant: cta.variant ?? 'default', size: cta.size ?? 'default' }),
        className
      )}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {cta.text}
      {cta.iconEnd && <HugeiconsIcon icon={cta.iconEnd} data-icon="inline-end" aria-hidden />}
      {external && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  );
}
