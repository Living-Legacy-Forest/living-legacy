// A choice of two to four options. Wider screens show plain options with the chosen one on a
// soft fill that glides between them; phones show iOS's segmented control: one grey
// track with the chosen option raised on it. Longer choices stay a picker.
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';
import { PillGlide, pillItemClass, pillTrackClass } from '@/components/ui/pill-track';
import { cn } from '@/lib/utils';

export function SegmentedControl<T extends string>({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  /** Two to four options. */
  options: { value: T; label: string; /** A small icon before the label. */ icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <ToggleGroup
      data-slot="pill-track"
      value={[value]}
      // Tapping the chosen option again keeps it chosen, as a segmented control does.
      onValueChange={(next) => next[0] && onValueChange(next[0] as T)}
      aria-label={label}
      className={cn(
        pillTrackClass,
        'touch:w-full',
        'max-md:w-full max-md:gap-0 max-md:rounded-[9px] max-md:bg-(--ios-fill) max-md:p-0.5',
        className
      )}
    >
      <PillGlide
        value={value}
        className="max-md:rounded-[7px] max-md:bg-(--ios-segment-on) max-md:shadow-sm"
      />
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className={cn(
            pillItemClass,
            'touch:min-h-11 touch:flex-1',
            // A 32pt segment whose tap area still reaches 44pt. Equal shares, but never narrower
            // than its own label (min-w-max), so a long word is not cut to "Upcom…" on a narrow
            // phone; the others give up the room. The icons are dropped below, which is what
            // made three segments wider than their track.
            'max-md:text-foreground max-md:h-8 max-md:min-h-8! max-md:min-w-max max-md:flex-1 max-md:rounded-[7px] max-md:border-0 max-md:px-1 max-md:text-[0.8125rem] max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1.5 max-md:aria-pressed:font-semibold'
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 [&_svg]:shrink-0">
            {/* iOS segments are words alone; the icon is for the wider screens. */}
            {option.icon && <span className="inline-flex max-md:hidden">{option.icon}</span>}
            <span className="min-w-0 truncate">{option.label}</span>
          </span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
