import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };

/**
 * A filter that takes several values: a button that shows how many are chosen and opens a list
 * of tick boxes. A file matching any ticked option shows. Nothing ticked means no filter.
 */
export function FilterMenu({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('touch:min-h-11', className)}
          />
        }
      >
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1.5">
            {selected.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1 p-1">
        <ul className="grid max-h-72 gap-0.5 overflow-y-auto" aria-label={label}>
          {options.map((option) => (
            <li key={option.value}>
              <label className="hover:bg-accent text-ui flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5">
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => toggle(option.value)}
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-muted-foreground text-xs tabular-nums">{option.count}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
        {selected.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear {label.toLowerCase()}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
