import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/lib/ui-states';

export type Focal = { x: number; y: number };

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The shapes the website crops images to, shown with the chosen point so its effect is clear. */
const SHAPES = [
  { label: 'Square', className: 'aspect-square w-20' },
  { label: 'Wide', className: 'aspect-video w-32' },
  { label: 'Tall', className: 'aspect-[3/4] w-16' },
] as const;

/**
 * Click the picture (or use the arrow keys) to choose the part that must stay in view when it is
 * cropped. Nothing about the file changes: the point is saved with it and used wherever the
 * image is cropped. Empty means the centre.
 */
export function FocalPicker({
  src,
  alt,
  value,
  onChange,
}: {
  src: string;
  alt: string;
  value: Focal | null;
  onChange: (value: Focal | null) => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const point = value ?? { x: 0.5, y: 0.5 };
  const position = `${pct(point.x)} ${pct(point.y)}`;

  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-label={`Focal point, ${pct(point.x)} across and ${pct(point.y)} down. Click the picture or use the arrow keys to move it.`}
        className={cn(
          'relative mx-auto block w-fit max-w-full cursor-crosshair overflow-hidden rounded-lg',
          FOCUS_RING
        )}
        onClick={(e) => {
          const rect = image.current?.getBoundingClientRect();
          if (!rect?.width || !rect.height) return;
          onChange({
            x: clamp((e.clientX - rect.left) / rect.width),
            y: clamp((e.clientY - rect.top) / rect.height),
          });
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const move = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          }[e.key];
          if (!move) return;
          e.preventDefault();
          e.stopPropagation();
          onChange({ x: clamp(point.x + move[0]!), y: clamp(point.y + move[1]!) });
        }}
      >
        <img
          ref={image}
          src={src}
          alt={alt}
          draggable={false}
          className="bg-muted block max-h-[70vh] w-auto max-w-full object-contain"
        />
        <span
          aria-hidden
          style={{ left: pct(point.x), top: pct(point.y) }}
          className={cn(
            'pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]',
            value ? 'bg-white/30' : 'bg-white/10 opacity-60'
          )}
        />
      </button>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-end gap-4">
          {SHAPES.map((shape) => (
            <figure key={shape.label} className="grid gap-1">
              <img
                src={src}
                alt=""
                style={{ objectPosition: position }}
                // The crops pan to a new point rather than jump, which shows what the point does.
                className={cn(
                  'bg-muted rounded-md object-cover transition-[object-position] duration-200 ease-out motion-reduce:transition-none',
                  shape.className
                )}
              />
              <figcaption className="text-muted-foreground text-xs">{shape.label}</figcaption>
            </figure>
          ))}
          {/* Only once there is something to reset: the centre is the default. */}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onChange(null)}
            >
              Reset to centre
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          Click the picture to choose what stays in view when it is cropped.
        </p>
      </div>
    </div>
  );
}
