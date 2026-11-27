import { FilterIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { choiceClass, pillClass } from '@/components/list/display-parts';
import { type MatchMode, useSavedFilters } from '@/components/list/filter-tools';
import { useState } from 'react';
import { cn } from '@/lib/utils';
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
export type ListFilterProps = {
  /**
   * Just the icon, with a dot when something is ticked, for a quiet toolbar. Left out, phones get
   * the labelled button and desktop the icon.
   */
  iconOnly?: boolean;
  groups: FilterGroup[];
  /** The ticked values of each group, by its key. */
  values: Record<string, string[]>;
  onChange: (key: string, next: string[]) => void;
  onClear: () => void;
  /** Phones only: a page whose Display menu already holds the filters (see ListDisplay). */
  hideOnDesktop?: boolean;
  /** Whether a row must match every group or any one. Shown in the Display panel, with a way to change it. */
  match?: MatchMode;
  onMatchChange?: (next: MatchMode) => void;
  /** Gives the page saved filter sets, kept in this browser under this name. */
  savedKey?: string;
};

export function ListFilter({ hideOnDesktop, ...props }: ListFilterProps) {
  if (props.iconOnly !== undefined) return <FilterControl {...props} />;
  if (hideOnDesktop)
    return (
      <div className="contents md:hidden">
        <FilterControl {...props} iconOnly={false} />
      </div>
    );
  return (
    <>
      <div className="contents md:hidden">
        <FilterControl {...props} iconOnly={false} />
      </div>
      <div className="contents max-md:hidden">
        <FilterControl {...props} iconOnly />
      </div>
    </>
  );
}

function FilterControl({ groups, values, onChange, onClear, iconOnly = false }: ListFilterProps) {
  const count = groups.reduce((n, g) => n + (values[g.key]?.length ?? 0), 0);
  const shown = groups.filter((g) => g.options.length > 0);
  if (shown.length === 0) return null;

  return (
    <Popover>
      {iconOnly ? (
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={count > 0 ? `Filter, ${count} on` : 'Filter'}
              title="Filter"
              className="text-muted-foreground hover:text-foreground relative shrink-0"
            />
          }
        >
          <FilterIcon aria-hidden />
          {count > 0 && (
            <span aria-hidden className="bg-brand absolute top-1 right-1 size-1.5 rounded-full" />
          )}
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              aria-label="Filter"
              className="text-ui shrink-0"
            />
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
      )}
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

/** How many values are ticked across a filter's groups. */
export function filterCount({ groups, values }: Pick<ListFilterProps, 'groups' | 'values'>) {
  return groups.reduce((n, g) => n + (values[g.key]?.length ?? 0), 0);
}

/** The filters as labelled chips, for a panel that has room for them (the Display menu). */
export function FilterSections({
  groups,
  values,
  onChange,
  onClear,
  match = 'all',
  onMatchChange,
  savedKey,
}: ListFilterProps) {
  const saved = useSavedFilters(savedKey);
  const [naming, setNaming] = useState<string | null>(null);
  const shown = groups.filter((g) => g.options.length > 0);
  if (shown.length === 0) return null;
  const count = filterCount({ groups, values });
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Filter</span>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Clear all
          </button>
        )}
      </div>
      {saved.enabled && (saved.views.length > 0 || count > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {saved.views.map((view) => (
            <span key={view.name} className="group/saved relative inline-flex">
              <button
                type="button"
                title="Apply this saved filter"
                onClick={() => {
                  for (const group of groups) onChange(group.key, view.values[group.key] ?? []);
                }}
                className={cn(pillClass(false), 'pr-3 group-hover/saved:pr-6')}
              >
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`Remove saved filter ${view.name}`}
                onClick={() => saved.remove(view.name)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 hidden -translate-y-1/2 text-xs group-hover/saved:block"
              >
                ×
              </button>
            </span>
          ))}
          {count > 0 &&
            (naming === null ? (
              <button
                type="button"
                onClick={() => setNaming('')}
                className="text-muted-foreground hover:text-foreground px-1 text-xs"
              >
                Save this filter
              </button>
            ) : (
              <input
                ref={(el) => el?.focus()}
                value={naming}
                maxLength={30}
                placeholder="Name it, then Enter"
                onChange={(e) => setNaming(e.target.value)}
                onBlur={() => setNaming(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setNaming(null);
                  if (e.key === 'Enter' && naming.trim()) {
                    saved.save(naming.trim(), values);
                    setNaming(null);
                  }
                }}
                className="bg-foreground/[0.07] h-7 w-40 rounded-full px-3 text-xs outline-none"
              />
            ))}
        </div>
      )}
      {onMatchChange && shown.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">Match</span>
          <div role="group" aria-label="Match" className="flex gap-1">
            {(
              [
                ['all', 'All'],
                ['any', 'Any'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={match === mode}
                onClick={() => onMatchChange(mode)}
                className={cn(
                  'focus-visible:ring-ring h-6 rounded-md px-3 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-2',
                  choiceClass(match === mode)
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3.5">
        {shown.map((group) => {
          const ticked = values[group.key] ?? [];
          return (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">{group.label}</span>
              <div className="flex flex-wrap gap-1">
                {group.options.map((option) => {
                  const on = ticked.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        onChange(
                          group.key,
                          on ? ticked.filter((v) => v !== option.value) : [...ticked, option.value]
                        )
                      }
                      className={pillClass(on)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
