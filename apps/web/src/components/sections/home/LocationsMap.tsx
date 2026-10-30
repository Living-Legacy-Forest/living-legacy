/**
 * Locations map island: the map image and its pins. Each pin is a shadcn
 * HoverCard (Base UI PreviewCard), which opens on hover and on keyboard
 * focus. The marker wrapper keeps the `location-marker` classes and
 * `data-location-marker` attribute from the previous CSS-only build, so the
 * pulsing ring, pin scale and the list-to-pin highlight script in
 * Locations.astro keep working unchanged. The list itself stays server
 * rendered in the .astro parent.
 */
import { HugeiconsIcon } from '@hugeicons/react';
import { Location01Icon, Call02Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LocationPin {
  key: string;
  label: string;
  name: string;
  address: string;
  phone: string;
  tel: string;
  href: string;
  photoSrc: string;
  photoWidth: number;
  photoHeight: number;
  marker: { x: number; y: number; align: 'start' | 'center' | 'end' };
}

interface Props {
  mapSrc: string;
  mapWidth: number;
  mapHeight: number;
  locations: LocationPin[];
}

export default function LocationsMap({ mapSrc, mapWidth, mapHeight, locations }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <img
        src={mapSrc}
        width={mapWidth}
        height={mapHeight}
        alt="Map of Australia marking the four Living Legacy locations"
        loading="lazy"
        className="h-auto w-full"
      />

      {locations.map((location) => (
        <div
          key={location.key}
          className="location-marker"
          style={{ left: `${location.marker.x}%`, top: `${location.marker.y}%` }}
          data-location-marker={location.key}
        >
          <HoverCard>
            <HoverCardTrigger
              render={
                <a
                  href={`#location-${location.key}`}
                  className="location-marker__pin"
                  aria-label={`${location.name}, ${location.address}`}
                >
                  <HugeiconsIcon
                    icon={Location01Icon}
                    className="h-10 w-10"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </a>
              }
            />
            <HoverCardContent
              side="top"
              align={location.marker.align}
              className="border-bark/20 bg-paper w-80 rounded-2xl border p-3 pr-5 shadow-[0_18px_40px_-18px_rgb(23_35_28/0.45)]"
            >
              <div className="flex gap-4">
                <img
                  src={location.photoSrc}
                  width={location.photoWidth}
                  height={location.photoHeight}
                  alt=""
                  className="size-18 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 py-1">
                  <p className="text-bark text-xs font-medium">{location.label}</p>
                  <p className="font-display mt-1 text-lg leading-tight tracking-tight">
                    {location.name}
                  </p>
                  <p className="text-ink-soft mt-1 text-xs leading-snug">{location.address}</p>
                  <div className="mt-3 flex flex-col items-start gap-1.5 text-xs font-medium">
                    <a
                      href={location.tel}
                      className="text-moss-deep hover:text-ink inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200"
                    >
                      <HugeiconsIcon icon={Call02Icon} className="h-3.5 w-3.5" aria-hidden="true" />
                      {location.phone}
                    </a>
                    <a
                      href={location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'link' }), 'gap-1 text-xs')}
                    >
                      Visit site
                      <HugeiconsIcon
                        icon={ArrowRight02Icon}
                        data-icon="inline-end"
                        className="size-3"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      ))}
    </div>
  );
}
