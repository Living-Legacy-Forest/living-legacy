import { useNavigate, useSearch } from '@tanstack/react-router';
import { SortIcon } from '@/components/icons';
import { markSorting } from '@/lib/sort-motion';
import { Button } from '@/components/ui/button';
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
export function ListSort<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0]!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 p-1">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {/* A label is a group part, so it lives inside the group it names. */}
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="text-ui">
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
