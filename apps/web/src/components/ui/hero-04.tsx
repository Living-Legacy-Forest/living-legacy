import * as React from 'react';

import { cn } from '@/lib/utils';

import { Cta, type CtaProps } from '@/components/ui/hero-04-utils/cta';
import { ArtCollage, type CollageImage } from '@/components/ui/hero-04-utils/art-collage';

export interface Hero04Props {
  title: string;
  washImage?: string;
  titleLine2?: string;
  description: string;
  primaryImage: CollageImage;
  secondaryImage: CollageImage;
  primaryAlt?: string;
  secondaryAlt?: string;
  /**
   * `rise` is the site's CSS entrance: it plays as soon as the HTML paints, so
   * the hero works rendered statically with no JavaScript. The registry's
   * `motion` entrance was removed: unused, it still loaded framer-motion into
   * the Worker on every home page render.
   */
  animation?: 'none' | 'rise';
  primaryCTA: CtaProps;
  secondaryCTA?: CtaProps;
  variant?: 'standard' | 'compact';
  /**
   * Fill the first screen below the site's announcement bar and header
   * (measured into --site-chrome by Header.astro), content centred. On short
   * wide screens the collage shrinks so the whole hero still fits.
   */
  fullHeight?: boolean;
}

// The collage's tall frame is about as tall as the collage is wide, so
// capping its width at the free height keeps it on screen. The 7rem leaves
// room for the section's padding and the frames' shadows.
const fullHeightStyles = {
  section: 'flex min-h-[calc(100svh-var(--site-chrome,8rem))] flex-col justify-center',
  grid: 'w-full pt-10 pb-16 lg:py-12',
  media: 'lg:max-w-[calc(100svh-var(--site-chrome,8rem)-7rem)] lg:justify-self-center',
} as const;

// Sizes come from the site's golden type scale rather than fixed steps.
const variantStyles = {
  standard: {
    section: 'pt-12 pb-20 lg:pt-20 lg:pb-28',
    title: 'display-title',
    description: 'lead max-w-xl',
    header: 'gap-7',
    grid: 'gap-14 lg:gap-16',
  },
  compact: {
    section: 'pt-10 pb-14 lg:pt-14 lg:pb-20',
    title: 'section-title',
    description: 'lead max-w-md',
    header: 'gap-5',
    grid: 'gap-10 lg:gap-12',
  },
} as const;

function Reveal({
  mode,
  delay,
  className,
  children,
}: Readonly<{
  mode: 'none' | 'rise';
  /** Seconds before the CSS entrance starts. */
  delay: number;
  className?: string;
  children: React.ReactNode;
}>) {
  if (mode === 'rise') {
    return (
      <div className={cn('rise', className)} style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

export function Hero04({
  title,
  titleLine2,
  description,
  washImage,
  primaryImage,
  secondaryImage,
  primaryAlt = '',
  secondaryAlt = '',
  animation = 'none',
  primaryCTA,
  secondaryCTA,
  variant = 'standard',
  fullHeight = false,
}: Readonly<Hero04Props>) {
  const vs = variantStyles[variant];

  const backgroundElement = washImage && (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 aspect-2/3 mask-radial-[75%_100%] mask-radial-from-45% mask-radial-to-75% mask-radial-at-top opacity-30 blur-2xl md:aspect-square lg:aspect-video"
    >
      <img
        src={washImage}
        alt=""
        decoding="async"
        fetchPriority="low"
        className="h-full w-full object-cover object-top"
      />
    </div>
  );

  const titleElement = title && (
    <h1 className={cn('text-foreground font-heading font-normal text-balance', vs.title)}>
      {title}
      {titleLine2 && (
        <>
          <br />
          {titleLine2}
        </>
      )}
    </h1>
  );

  const descriptionElement = description && (
    <p className={cn('text-pretty', vs.description)}>{description}</p>
  );

  const ctasElement = (primaryCTA?.ctaEnabled || secondaryCTA?.ctaEnabled) && (
    <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
      {primaryCTA?.ctaEnabled && <Cta cta={primaryCTA} />}
      {secondaryCTA?.ctaEnabled && (
        <Cta cta={{ ...secondaryCTA, variant: secondaryCTA.variant ?? 'link' }} />
      )}
    </div>
  );

  const mediaElement = (
    <ArtCollage
      primaryImage={primaryImage}
      secondaryImage={secondaryImage}
      primaryAlt={primaryAlt}
      secondaryAlt={secondaryAlt}
    />
  );

  const gridClass = cn(
    'relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center px-6 sm:px-10 lg:grid-cols-2',
    fullHeight ? fullHeightStyles.grid : vs.section,
    vs.grid
  );

  const content = (
    <>
      <Reveal mode={animation} delay={0.05} className={cn('flex flex-col items-start', vs.header)}>
        {titleElement}
        {descriptionElement}
        {ctasElement}
      </Reveal>

      <Reveal
        mode={animation}
        delay={0.2}
        className={cn('w-full', fullHeight && fullHeightStyles.media)}
      >
        {mediaElement}
      </Reveal>
    </>
  );

  return (
    <section
      className={cn(
        'bg-background relative isolate w-full overflow-hidden',
        fullHeight && fullHeightStyles.section
      )}
    >
      {backgroundElement}

      <div className={gridClass}>{content}</div>
    </section>
  );
}

export default Hero04;
