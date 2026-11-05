// Maps for a location: a pinned preview, and the picker that sets the pin.
// The pin uses the hero photo when there is one, so the preview reads like
// the directory card it stands in for.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPinIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Map as MapView, MapControls, MapMarker, MarkerContent, useMap } from '@/components/ui/map';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type Pin = { latitude: number; longitude: number };

/** All of Australia, for a location that has no pin yet. */
const AUSTRALIA = { center: [134, -28] as [number, number], zoom: 2.6 };
const PIN_ZOOM = 13;

function PinMarker({ pin, photoUrl, ...drag }: { pin: Pin; photoUrl?: string | null } & DragProps) {
  return (
    <MapMarker longitude={pin.longitude} latitude={pin.latitude} {...drag}>
      <MarkerContent>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="size-10 rounded-full border-2 border-white object-cover shadow-lg"
          />
        ) : (
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full border-2 border-white shadow-lg">
            <MapPinIcon aria-hidden className="size-4" />
          </span>
        )}
      </MarkerContent>
    </MapMarker>
  );
}

type DragProps = {
  draggable?: boolean;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
};

/** Moves the view to the pin whenever it changes from outside the map. */
function FollowPin({ pin }: { pin: Pin | null }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded || !pin) return;
    map.easeTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), PIN_ZOOM) });
  }, [map, isLoaded, pin?.latitude, pin?.longitude]);
  return null;
}

/**
 * Folds the map credit into its ⓘ button. MapLibre opens it on load, which
 * covers much of a small map; the credit stays one click away.
 */
function FoldedAttribution() {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    map
      .getContainer()
      .querySelector('.maplibregl-ctrl-attrib')
      ?.classList.remove('maplibregl-compact-show');
  }, [map, isLoaded]);
  return null;
}

/** Calls back with the spot clicked on the map. */
function ClickToPin({ onPick }: { onPick: (pin: Pin) => void }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const handle = (e: { lngLat: { lng: number; lat: number } }) =>
      onPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    map.on('click', handle);
    return () => {
      map.off('click', handle);
    };
  }, [map, isLoaded, onPick]);
  return null;
}

/** The location pinned on a map, for the preview pane. */
export function LocationMap({
  pin,
  photoUrl,
  className,
}: {
  pin: Pin | null;
  photoUrl?: string | null;
  className?: string;
}) {
  if (!pin) {
    return (
      <div
        className={cn(
          'bg-muted text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-xs',
          className
        )}
      >
        <MapPinIcon aria-hidden className="size-5" />
        Not on the map yet
      </div>
    );
  }
  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      <MapView center={[pin.longitude, pin.latitude]} zoom={PIN_ZOOM}>
        <FollowPin pin={pin} />
        <FoldedAttribution />
        <PinMarker pin={pin} photoUrl={photoUrl} />
        <MapControls />
      </MapView>
    </div>
  );
}

/**
 * Sets the pin: found from the address, placed with a click, or dragged into
 * place. The address is looked up with OpenStreetMap's free geocoder.
 */
export function PinPicker({
  id,
  pin,
  address,
  photoUrl,
  onChange,
}: {
  id: string;
  pin: Pin | null;
  address: string;
  photoUrl?: string | null;
  onChange: (pin: Pin | null) => void;
}) {
  const [finding, setFinding] = useState(false);
  const [start] = useState(() =>
    pin ? { center: [pin.longitude, pin.latitude] as [number, number], zoom: PIN_ZOOM } : AUSTRALIA
  );

  async function find() {
    setFinding(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({
        q: address,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'au',
      }).toString();
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) {
        toast.error('That address was not found. Click the map to place the pin instead.');
        return;
      }
      onChange({ latitude: Number(hit.lat), longitude: Number(hit.lon) });
    } catch {
      toast.error('Could not look up the address. Click the map to place the pin instead.');
    } finally {
      setFinding(false);
    }
  }

  return (
    <div className="space-y-2">
      <div id={id} className="h-56 overflow-hidden rounded-lg border">
        <MapView center={start.center} zoom={start.zoom}>
          <FollowPin pin={pin} />
          <FoldedAttribution />
          <ClickToPin onPick={onChange} />
          {pin && (
            <PinMarker
              pin={pin}
              photoUrl={photoUrl}
              draggable
              onDragEnd={(lngLat) => onChange({ latitude: lngLat.lat, longitude: lngLat.lng })}
            />
          )}
          <MapControls />
        </MapView>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={finding || address.trim() === ''}
          onClick={find}
        >
          {finding && <Spinner />}
          Find from address
        </Button>
        {pin && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onChange(null)}
          >
            Remove pin
          </Button>
        )}
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {pin ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}` : 'No pin yet'}
        </span>
      </div>
    </div>
  );
}
