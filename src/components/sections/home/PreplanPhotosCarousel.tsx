/**
 * Pre-plan photo carousel island. The parent .astro component computes
 * optimised image URLs with astro:assets' getImage() (React islands cannot
 * use astro:assets directly) and passes plain src/width/height/alt props.
 */
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export default function PreplanPhotosCarousel({ photos }: { photos: Photo[] }) {
  return (
    <Carousel opts={{ align: 'start', loop: false }} className="mt-10">
      <div className="flex justify-end gap-3">
        <CarouselPrevious className="static translate-x-0 translate-y-0" />
        <CarouselNext className="static translate-x-0 translate-y-0" />
      </div>

      <CarouselContent className="mt-6">
        {photos.map((photo) => (
          <CarouselItem key={photo.src} className="basis-[78%] sm:basis-[46%] lg:basis-[30%]">
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt={photo.alt}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-xl object-cover"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
