import { FilterIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type FilterGroup = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

/** The Status group's options for content with a draft/published switch. */
export const publishStatusOptions = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

/** One option per distinct, non-empty value, sorted, for groups built from free text. */
export function optionsOf(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))]
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v }));
}

/** Whether an item passes a group: nothing ticked, or its value is one of the ticks. */
export function passes(ticked: string[] | undefined, value: string | null | undefined) {
  return !ticked?.length || (!!value && ticked.includes(value));
}

/**
 * A Filter button over a searchable popover with a group of options for each thing a list can
 * be narrowed by. Within a group the ticks widen (any of them); between groups they narrow.
 */
export function ListFilter({
  groups,
  values,
  onChange,
  onClear,
}: {
  groups: FilterGroup[];
  /** The ticked values of each group, by its key. */
  values: Record<string, string[]>;
  onChange: (key: string, next: string[]) => void;
  onClear: () => void;
}) {
  const count = groups.reduce((n, g) => n + (values[g.key]?.length ?? 0), 0);
  const shown = groups.filter((g) => g.options.length > 0);
  if (shown.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="secondary" size="sm" aria-label="Filter" className="text-ui shrink-0" />
        }
      >
        <FilterIcon aria-hidden data-icon="inline-start" />
        Filter
        {count > 0 && (
          <Badge variant="outline" className="ml-0.5 tabular-nums">
            {count}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Find a filter…" />
          <CommandList>
            <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
              Nothing matches.
            </CommandEmpty>
            {shown.map((group) => {
              const ticked = values[group.key] ?? [];
              return (
                <CommandGroup key={group.key} heading={group.label}>
                  {group.options.map((option) => {
                    const on = ticked.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        // The group's name is searchable too, so "author" lists the authors.
                        value={`${group.label} ${option.label}`}
                        data-checked={on || undefined}
                        onSelect={() =>
                          onChange(
                            group.key,
                            on
                              ? ticked.filter((v) => v !== option.value)
                              : [...ticked, option.value]
                          )
                        }
                      >
                        {/* The tick comes from the item itself (data-checked), on the right. */}
                        <span className="min-w-0 truncate">{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
            {count > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="clear all filters" onSelect={onClear}>
                    Clear all
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
