import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { CheckIcon, SortIcon } from '@/components/icons';
import { sheetGroupClass, sheetRowClass } from '@/components/shell/sheet-parts';
import { useIsMobile } from '@/hooks/use-mobile';
import { markSorting } from '@/lib/sort-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SortOption = {
  value: string;
  label: string;
};

/**
 * The order a list is in, kept in the page address as `sort` so it survives going back and can
 * be shared. The first option is the page's own order and is left out of the address. A value
 * that is not one of the options (an old link) falls back to it.
 */
export function useListSort<T extends string>(options: readonly { value: T }[]) {
  const search = useSearch({ strict: false }) as { sort?: string };
  const navigate = useNavigate();
  const fallback = options[0]!.value;
  const value = options.find((o) => o.value === search.sort)?.value ?? fallback;
  const setValue = (next: T) => {
    // Before the new order renders, so the rows glide to it.
    markSorting();
    void navigate({
      to: '.',
      // A new order starts again from the first page, where there is one.
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        sort: next === fallback ? undefined : next,
        page: undefined,
        show: undefined,
      })) as never,
      replace: true,
      resetScroll: false,
    });
  };
  return [value, setValue] as const;
}

/** A Sort button beside Filter: a menu of the orders this list can be in, the current one ticked. */
export function ListSort<T extends string>({ hideOnDesktop, ...props }: SortProps<T>) {
  if (props.iconOnly !== undefined) return <SortControl {...props} />;
  if (hideOnDesktop)
    return (
      <div className="contents md:hidden">
        <SortControl {...props} iconOnly={false} />
      </div>
    );
  return (
    <>
      <div className="contents md:hidden">
        <SortControl {...props} iconOnly={false} />
      </div>
      <div className="contents max-md:hidden">
        <SortControl {...props} iconOnly />
      </div>
    </>
  );
}

type SortProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Just the icon. Left out, phones get the labelled button and desktop the icon. */
  iconOnly?: boolean;
  /** Phones only: a page whose Display menu already holds the ordering. */
  hideOnDesktop?: boolean;
};

function SortControl<T extends string>({ options, value, onChange, iconOnly }: SortProps<T>) {
  const isPhone = useIsMobile();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0]!;
  if (isPhone) {
    // Phones: a bottom sheet (Popover becomes one), its rows in reach of a thumb.
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Sort, by ${current.label}`}
              className="text-ui shrink-0"
            />
          }
        >
          <SortIcon aria-hidden data-icon="inline-start" />
          Sort
        </PopoverTrigger>
        <PopoverContent>
          <PopoverTitle className="text-ui px-4 font-normal text-(--ios-secondary) uppercase">
            Sort by
          </PopoverTitle>
          <div role="radiogroup" aria-label="Sort by" className={sheetGroupClass}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === value}
                onClick={() => {
                  setOpen(false);
                  if (option.value !== value) onChange(option.value);
                }}
                className={sheetRowClass}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value && <CheckIcon aria-hidden className="text-tint" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={iconOnly ? 'ghost' : 'secondary'}
            size={iconOnly ? 'icon-sm' : 'sm'}
            aria-label={`Sort, by ${current.label}`}
            title={iconOnly ? 'Sort' : undefined}
            className={
              iconOnly ? 'text-muted-foreground hover:text-foreground shrink-0' : 'text-ui shrink-0'
            }
          />
        }
      >
        <SortIcon aria-hidden data-icon={iconOnly ? undefined : 'inline-start'} />
        {!iconOnly && 'Sort'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 p-1">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {/* A label is a group part, so it lives inside the group it names. */}
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compares two values for a sort: text in the reader's order, numbers and dates by size. */
export const byText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', 'en-AU', { sensitivity: 'base', numeric: true });
export const byNumber = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? 0) - (b ?? 0);

/**
 * `rows` in the chosen order. An option with no comparator is the page's own order, which the
 * data already arrives in, so it is returned as it is.
 */
export function sortedBy<T>(
  rows: T[],
  sort: string,
  comparators: Record<string, (a: T, b: T) => number>
): T[] {
  const compare = comparators[sort];
  return compare ? [...rows].sort(compare) : rows;
}
