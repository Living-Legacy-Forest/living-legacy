import { PinPicker } from '@/components/locations/location-map';
import type { LocationEditorState } from './use-location-editor';

/** The map beside the form, where the pin is found, clicked into place or dragged. */
export function LocationMapPanel({ editor }: { editor: LocationEditorState }) {
  const { values, patch } = editor;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Map pin</h2>
      <p className="text-muted-foreground text-xs">
        Find it from the address, then drag the pin or click the map to fine-tune it.
      </p>
      <PinPicker
        id="loc-pin"
        pin={values.pin}
        address={values.address}
        photoUrl={editor.heroUrl}
        onChange={(pin) => patch({ pin })}
        // Tall beside the form; below lg it sits under it at a normal height.
        mapClassName="h-80 lg:h-[calc(100svh-17rem)]"
      />
    </div>
  );
}
