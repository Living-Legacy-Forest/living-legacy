// Maps for locations: every location on one map, the picker that sets a
// location's pin, and one pin to look at. A pin wears the location's hero photo
// when it has one.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { MapPinIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';

export type Pin = { latitude: number; longitude: number };

/** All of Australia, for a location that has no pin yet. */
const AUSTRALIA = { center: [134, -28] as [number, number], zoom: 2.6 };
const PIN_ZOOM = 13;
/** The width of the location sheet, sm:max-w-md. */
const SHEET_WIDTH = 448;

function PinMarker({
  pin,
  photoUrl,
  name,
  selected = false,
  onClick,
  ...drag
}: {
  pin: Pin;
  photoUrl?: string | null;
  /** Shown on hover. */
  name?: string;
  selected?: boolean;
  onClick?: () => void;
} & DragProps) {
  return (
    <MapMarker
      longitude={pin.longitude}
      latitude={pin.latitude}
      onClick={onClick && ((e) => (e.stopPropagation(), onClick()))}
      {...drag}
    >
      <MarkerContent className={cn(selected && 'z-10')}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className={cn(
              'size-10 rounded-full border-2 border-white object-cover shadow-md transition-transform duration-200 ease-out hover:scale-110',
              selected && 'ring-brand/35 scale-110 ring-4'
            )}
          />
        ) : (
          <span
            className={cn(
              'bg-brand dark:text-background flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform duration-200 ease-out hover:scale-110',
              selected && 'ring-brand/35 scale-110 ring-4'
            )}
          >
            <MapPinIcon aria-hidden className="size-4" />
          </span>
        )}
      </MarkerContent>
      {name && (
        <MarkerTooltip anchor="bottom" offset={22} className="font-medium">
          {name}
        </MarkerTooltip>
      )}
    </MapMarker>
  );
}

type DragProps = {
  draggable?: boolean;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
};

/**
 * The CMS theme, read from <html>.dark. The map only notices a `light` class,
 * which the CMS never sets, so without this it would stay dark in light mode.
 */
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
export function useCmsTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light'
  );
}

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
export function FoldedAttribution() {
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

export type MapLocation = {
  id: string;
  name: string;
  pin: Pin | null;
  photoUrl: string | null;
};

/**
 * Frames every pin on first load, and moves to the selected one whenever the
 * selection changes after that.
 */
function FrameLocations({ pins, selected }: { pins: Pin[]; selected: Pin | null }) {
  const { map, mapLib, isLoaded } = useMap();
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    if (!map || !mapLib || !isLoaded || framed) return;
    setFramed(true);
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.jumpTo({ center: [pins[0]!.longitude, pins[0]!.latitude], zoom: 11 });
      return;
    }
    const bounds = new mapLib.LngLatBounds();
    pins.forEach((p) => bounds.extend([p.longitude, p.latitude]));
    map.fitBounds(bounds, { padding: 64, maxZoom: 11, duration: 0 });
  }, [map, mapLib, isLoaded, framed, pins]);

  useEffect(() => {
    if (!map || !isLoaded || !framed || !selected) return;
    // The details sheet covers the right of the screen, so centre the pin in
    // the part of the map still showing.
    const box = map.getContainer().getBoundingClientRect();
    const covered = Math.max(0, box.right - (window.innerWidth - SHEET_WIDTH));
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 11),
      offset: [-Math.min(covered, box.width - 80) / 2, 0],
      duration: 900,
    });
  }, [map, isLoaded, framed, selected?.latitude, selected?.longitude]);

  return null;
}

/** Every location with a pin, on one map. Clicking a pin selects it. */
export function LocationsOverviewMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: MapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const theme = useCmsTheme();
  const pinned = locations.filter((l): l is MapLocation & { pin: Pin } => l.pin !== null);
  const selected = pinned.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="relative size-full">
      <MapView theme={theme} center={AUSTRALIA.center} zoom={AUSTRALIA.zoom}>
        <FrameLocations pins={pinned.map((l) => l.pin)} selected={selected?.pin ?? null} />
        <FoldedAttribution />
        {pinned.map((l) => (
          <PinMarker
            key={l.id}
            pin={l.pin}
            photoUrl={l.photoUrl}
            name={l.name}
            selected={l.id === selectedId}
            onClick={() => onSelect(l.id)}
          />
        ))}
        <MapControls />
      </MapView>
      {pinned.length < locations.length && (
        <div className="bg-background/90 text-muted-foreground absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
          {pinned.length} of {locations.length} on the map. Add a pin in Edit for the rest.
        </div>
      )}
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
  mapClassName,
}: {
  id: string;
  pin: Pin | null;
  address: string;
  photoUrl?: string | null;
  onChange: (pin: Pin | null) => void;
  /** The map's size; 14rem tall unless the caller has more room. */
  mapClassName?: string;
}) {
  const theme = useCmsTheme();
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
        notify.error('Address not found', 'Click the map to place the pin instead.');
        return;
      }
      onChange({ latitude: Number(hit.lat), longitude: Number(hit.lon) });
    } catch {
      notify.error('Could not look up the address', 'Click the map to place the pin instead.');
    } finally {
      setFinding(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Panning the map must not drag the phone sheet closed. */}
      <div
        id={id}
        data-base-ui-swipe-ignore
        className={cn('h-56 overflow-hidden rounded-lg border', mapClassName)}
      >
        <MapView theme={theme} center={start.center} zoom={start.zoom}>
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

/** One pin to look at, not change: an event's location in its preview. */
export function LocationPinMap({ pin, name }: { pin: Pin; name?: string }) {
  const theme = useCmsTheme();
  return (
    <MapView theme={theme} center={[pin.longitude, pin.latitude]} zoom={PIN_ZOOM}>
      <FoldedAttribution />
      <PinMarker pin={pin} name={name} />
      <MapControls />
    </MapView>
  );
}
