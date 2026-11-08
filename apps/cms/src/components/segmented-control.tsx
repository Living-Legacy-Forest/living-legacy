// A choice of two to four options. Wider screens show the outlined toggle
// buttons the CMS already uses; phones show iOS's segmented control: one grey
// track with the chosen option raised on it. Longer choices stay a picker.
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[value]}
      // Tapping the chosen option again keeps it chosen, as a segmented control does.
      onValueChange={(next) => next[0] && onValueChange(next[0] as T)}
      aria-label={label}
      className={cn(
        'touch:w-full',
        'max-md:w-full max-md:gap-0! max-md:rounded-[9px] max-md:bg-(--ios-fill) max-md:p-0.5',
        className
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            'touch:min-h-11 touch:flex-1 text-xs',
            // A 32pt segment whose tap area still reaches 44pt.
            'max-md:relative max-md:min-h-8! max-md:flex-1 max-md:rounded-[7px]! max-md:border-0 max-md:bg-transparent max-md:text-[0.8125rem] max-md:shadow-none max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1.5',
            'max-md:hover:bg-transparent max-md:aria-pressed:bg-(--ios-segment-on) max-md:aria-pressed:font-semibold max-md:aria-pressed:shadow-sm max-md:motion-safe:transition-colors'
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
