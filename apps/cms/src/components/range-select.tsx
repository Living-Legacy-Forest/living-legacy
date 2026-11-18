import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RANGES, type Range } from '@/components/stat-card/shared';

const OPTIONS = RANGES.map((days) => ({ value: String(days), label: `${days} days` }));

/** A quiet menu for the span a card covers: 7, 30 or 90 days, in the corner of its title row. */
export function RangeSelect({
  label,
  value,
  onChange,
}: {
  /** Names the menu for assistive technology, e.g. the card's title. */
  label: string;
  value: Range;
  onChange: (range: Range) => void;
}) {
  return (
    <Select
      items={OPTIONS}
      value={String(value)}
      onValueChange={(next) => next && onChange(Number(next) as Range)}
    >
      <SelectTrigger
        aria-label={`${label}: period shown`}
        size="sm"
        className="text-muted-foreground -my-1 -mr-2 h-7 gap-1 border-transparent bg-transparent text-xs shadow-none dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
