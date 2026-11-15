import { useEffect } from 'react';
import { FoldedAttribution, useCmsTheme } from '@/components/locations/location-map';
import {
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map';
import { formatInteger } from '@/lib/format';
import type { Place } from '@/server/analytics';

/** All of Australia, for the moment before the places are framed. */
const START = { center: [134, -28] as [number, number], zoom: 2.6 };

/** Frames every place when they first show, and again if the places change (a new period). */
function FramePlaces({ places }: { places: Place[] }) {
  const { map, mapLib, isLoaded } = useMap();
  const signature = places.map((p) => `${p.key}:${p.visits}`).join('|');

  useEffect(() => {
    if (!map || !mapLib || !isLoaded || places.length === 0) return;
    if (places.length === 1) {
      map.jumpTo({ center: [places[0]!.longitude, places[0]!.latitude], zoom: 6 });
      return;
    }
    const bounds = new mapLib.LngLatBounds();
    places.forEach((p) => bounds.extend([p.longitude, p.latitude]));
    map.fitBounds(bounds, { padding: 56, maxZoom: 6, duration: 0 });
  }, [map, mapLib, isLoaded, signature]);

  return null;
}

/**
 * A bubble for each city, sized by its share of the visits so the busiest stand out. Hovering one
 * names the city and its visits. Bubbles are drawn smallest last-to-first, so a small one in the
 * shadow of a big one is still reachable.
 */
export function PlacesMap({ places }: { places: Place[] }) {
  const theme = useCmsTheme();
  const top = Math.max(1, ...places.map((p) => p.visits));
  const bySize = [...places].sort((a, b) => b.visits - a.visits);

  return (
    <MapView theme={theme} center={START.center} zoom={START.zoom}>
      <FramePlaces places={places} />
      <FoldedAttribution />
      {bySize.map((p) => {
        const size = Math.round(10 + 30 * Math.sqrt(p.visits / top));
        return (
          <MapMarker key={p.key} longitude={p.longitude} latitude={p.latitude}>
            <MarkerContent>
              <span
                aria-hidden
                className="bg-brand/45 border-brand hover:bg-brand/70 block rounded-full border transition-colors duration-200 ease-out"
                style={{ width: size, height: size }}
              />
            </MarkerContent>
            <MarkerTooltip
              anchor="bottom"
              offset={Math.round(size / 2) + 4}
              className="font-medium"
            >
              {[p.city, p.country].filter(Boolean).join(', ')} · {formatInteger(p.visits)}{' '}
              {p.visits === 1 ? 'visit' : 'visits'}
            </MarkerTooltip>
          </MapMarker>
        );
      })}
      <MapControls />
    </MapView>
  );
}
