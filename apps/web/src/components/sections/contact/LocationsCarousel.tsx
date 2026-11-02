/**
 * The locations strip on the contact page, as a carousel. The parent .astro
 * page optimises the photos with astro:assets' getImage() (React islands
 * cannot use astro:assets directly) and passes plain props.
 *
 * Each location is a card: photo, name, address, then the phone number and
 * website as links.
 */
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

export interface Location {
  name: string;
  address: string;
  phone: string;
  phoneHref: string;
  website: string;
  image: { src: string; width: number; height: number };
}

export default function LocationsCarousel({ locations }: { locations: Location[] }) {
  return (
    <Carousel opts={{ align: 'start', loop: false }}>
      <div className="flex items-end justify-between gap-6">
        <h2 className="section-title">Our locations</h2>
        <div className="flex shrink-0 gap-3">
          <CarouselPrevious className="static translate-x-0 translate-y-0" />
          <CarouselNext className="static translate-x-0 translate-y-0" />
        </div>
      </div>

      {/* The card outline is a border, not the default ring: the carousel clips
          anything drawn outside the cards. */}
      <CarouselContent className="mt-10">
        {locations.map((location) => (
          <CarouselItem key={location.name} className="basis-[85%] sm:basis-[46%] lg:basis-[31%]">
            <Card className="border-border h-full gap-0 border py-0 ring-0">
              <img
                src={location.image.src}
                width={location.image.width}
                height={location.image.height}
                alt=""
                loading="lazy"
                decoding="async"
                className="bg-paper-deep aspect-[4/3] w-full object-cover"
              />
              <CardContent className="flex flex-1 flex-col py-6">
                <h3 className="card-title">{location.name}</h3>
                <p className="text-ink-soft mt-2 text-base text-pretty">{location.address}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 pt-4 text-base font-medium">
                  <a
                    href={location.phoneHref}
                    className="text-moss-deep hover:text-ink transition-colors duration-200"
                  >
                    {location.phone}
                  </a>
                  <a
                    href={location.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-soft hover:text-moss-deep transition-colors duration-200"
                  >
                    Visit website
                  </a>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
