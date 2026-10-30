/** An image URL, or an optimised image with its responsive candidates. */
export type CollageImage = string | { src: string; srcSet?: string };

const source = (image: CollageImage) =>
  typeof image === 'string' ? { src: image } : { src: image.src, srcSet: image.srcSet };

/**
 * Two overlapping photographs: a tall 4:5 frame, and a smaller square tilted
 * over its lower right corner. Both frames hold a fixed aspect ratio, so
 * nothing shifts while the photos load.
 */
export function ArtCollage({
  primaryImage,
  secondaryImage,
  primaryAlt = '',
  secondaryAlt = '',
}: Readonly<{
  primaryImage: CollageImage;
  secondaryImage: CollageImage;
  primaryAlt?: string;
  secondaryAlt?: string;
}>) {
  return (
    <div className="relative mx-auto w-full max-w-md sm:max-w-lg">
      <div className="relative aspect-[4/5] w-[82%] overflow-hidden rounded-2xl shadow-[0_30px_60px_-30px_rgb(23_35_28/0.55)] outline outline-black/10">
        {/* The page's largest image, so it loads first. */}
        <img
          {...source(primaryImage)}
          alt={primaryAlt}
          sizes="(min-width: 640px) 420px, 82vw"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="size-full object-cover"
        />
        <div className="from-background/20 absolute inset-0 bg-gradient-to-t to-transparent" />
      </div>

      <div className="border-paper absolute -right-2 bottom-6 aspect-square w-[42%] rotate-3 overflow-hidden rounded-xl border-4 shadow-[0_20px_40px_-20px_rgb(23_35_28/0.6)] sm:-right-4">
        <img
          {...source(secondaryImage)}
          alt={secondaryAlt}
          sizes="(min-width: 640px) 215px, 42vw"
          loading="eager"
          decoding="async"
          className="size-full object-cover"
        />
      </div>
    </div>
  );
}
