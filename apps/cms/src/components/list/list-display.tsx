import { cloneElement, type ReactElement } from 'react';
import { SlidersIcon } from '@/components/icons';
import { ViewButtons } from '@/components/list/display-parts';
import { FilterSections, filterCount, type ListFilterProps } from '@/components/list/list-filter';
import { ViewSwitch, type ListView } from '@/components/list/view-switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Option = { value: string; label: string };

/**
 * A list page's Display control, as on the posts page. Desktop gets one icon that opens the view
 * and the ordering together; phones keep the plain List/Grid switch (the Sort button sits
 * beside it).
 */
export function ListDisplay({
  value,
  onChange,
  sortOptions,
  sortValue,
  onSortChange,
  filter,
}: {
  /** The list or grid view. */
  value: ListView;
  onChange: (next: ListView) => void;
  sortOptions?: readonly Option[];
  sortValue?: string;
  onSortChange?: (next: string) => void;
  /** A ListFilter. Phones keep it as its own button; on desktop its filters join this panel. */
  filter?: ReactElement<ListFilterProps>;
}) {
  const filterProps = filter?.props;
  const filtering = filterProps ? filterCount(filterProps) : 0;
  const ordering = sortOptions && sortValue !== undefined && onSortChange;
  return (
    <>
      {filter && cloneElement(filter, { hideOnDesktop: true })}
      <div className="contents md:hidden">
        <ViewSwitch value={value} onChange={onChange} />
      </div>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Display options"
              title="Display"
              className="text-muted-foreground hover:text-foreground relative shrink-0 max-md:hidden"
            />
          }
        >
          <SlidersIcon aria-hidden />
          {filtering > 0 && (
            <span aria-hidden className="bg-brand absolute top-1 right-1 size-1.5 rounded-full" />
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)] gap-3.5 p-3">
          <ViewButtons value={value} onChange={onChange} />
          {ordering && (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="list-ordering" className="text-muted-foreground text-xs">
                Ordering
              </label>
              <Select
                items={sortOptions}
                value={sortValue}
                onValueChange={(next) => next && onSortChange(next)}
              >
                <SelectTrigger
                  id="list-ordering"
                  size="sm"
                  className="w-36 data-[size=sm]:h-7 md:text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {filterProps && <FilterSections {...filterProps} />}
        </PopoverContent>
      </Popover>
    </>
  );
}
