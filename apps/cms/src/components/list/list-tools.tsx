import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SearchIcon, Trash2Icon, XIcon } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Shared by the list-and-pane pages: search, multi-select and bulk delete.

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Phones say just "Search", as iOS does; the page's title already says what.
  const isMobile = useIsMobile();
  return (
    <div className="relative w-full sm:w-56">
      <SearchIcon
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      />
      <input
        aria-label={label}
        placeholder={isMobile ? 'Search' : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // Phones zoom into a field under 16px, so the smaller size starts at md.
        className="bg-muted/60 placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring md:text-ui touch:h-11 h-8 w-full rounded-md pr-2 pl-8 text-base outline-none focus-visible:ring-1 max-md:h-9 max-md:rounded-[10px] max-md:bg-(--ios-fill) max-md:text-[1.0625rem] max-md:placeholder:text-(--ios-secondary) max-md:focus-visible:bg-(--ios-fill) max-md:focus-visible:ring-0"
      />
    </div>
  );
}

/** True when any of the values contains the query, ignoring case. */
export function matchesSearch(query: string, values: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => v?.toLowerCase().includes(q));
}

/**
 * Ticked rows. `ids` are the rows that still exist, so deleted ones drop out.
 *
 * `selecting` is true while anything is ticked, or while Edit mode is on: on
 * touch screens there is no hover to reveal the tick boxes, so the list header
 * offers Edit / Done instead (as in iOS Mail).
 */
export function useSelection(ids: string[]) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const checkedIds = ids.filter((id) => checked.has(id));

  return {
    checkedIds,
    selecting: editing || checkedIds.length > 0,
    isChecked: (id: string) => checked.has(id),
    toggle: (id: string) =>
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    set: (next: string[]) => setChecked(new Set(next)),
    startEditing: () => setEditing(true),
    /** Unticks everything and leaves Edit mode. */
    clear: () => {
      setChecked(new Set());
      setEditing(false);
    },
  };
}

export type Selection = ReturnType<typeof useSelection>;

/**
 * The list header: a select-all box, then either the count or the selection's
 * actions. Without `onDelete` (people who cannot edit) it is just the count.
 */
export function SelectionBar({
  selection,
  visibleIds,
  title,
  total,
  pending,
  onDelete,
  editInTopBar = true,
}: {
  selection: Selection;
  visibleIds: string[];
  title: string;
  total: number;
  pending: boolean;
  onDelete?: () => void;
  /** Phones: Edit is in the top bar (PageActions), so the bar does not show its own. */
  editInTopBar?: boolean;
}) {
  const count = selection.checkedIds.length;
  // Phones: the bar is the small grey heading above the grouped list.
  const phoneHeading =
    'max-md:h-auto max-md:min-h-8 max-md:border-0 max-md:px-4 max-md:pb-1.5 max-md:[&>span]:text-[0.8125rem] max-md:[&>span]:font-normal max-md:[&>span]:text-(--ios-secondary) max-md:[&>span]:uppercase';
  const allChecked = visibleIds.length > 0 && visibleIds.every(selection.isChecked);
  const filtered = visibleIds.length !== total;

  if (!onDelete) {
    return (
      <div className={cn('flex h-11 shrink-0 items-center gap-2 border-b px-3', phoneHeading)}>
        <span className="text-ui font-medium">{filtered ? 'Shown' : title}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {filtered ? `${visibleIds.length} of ${total}` : total}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-3', phoneHeading)}>
      <Checkbox
        aria-label={allChecked ? 'Clear selection' : 'Select all shown'}
        checked={allChecked}
        disabled={visibleIds.length === 0}
        onCheckedChange={() => (allChecked ? selection.clear() : selection.set(visibleIds))}
        className={cn(!selection.selecting && 'touch:hidden')}
      />
      {count > 0 ? (
        <>
          <span className="text-ui mr-auto">{count} selected</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2Icon aria-hidden data-icon="inline-start" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear selection"
            onClick={selection.clear}
          >
            <XIcon aria-hidden />
          </Button>
        </>
      ) : (
        <>
          <span className="text-ui font-medium">{filtered ? 'Shown' : title}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filtered ? `${visibleIds.length} of ${total}` : total}
          </span>
          {/* Touch screens: the way into ticking rows, in place of hover. */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'text-tint touch:inline-flex ml-auto hidden min-h-11 text-[0.9375rem] font-medium',
              editInTopBar && 'max-md:hidden!'
            )}
            onClick={selection.selecting ? selection.clear : selection.startEditing}
          >
            {selection.selecting ? 'Done' : 'Edit'}
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * A row's tick box: hidden until hover, and always shown once anything is
 * ticked. Touch screens have no hover, so there it takes no space at all until
 * Edit mode.
 */
export function RowCheckbox({
  label,
  checked,
  selecting,
  onToggle,
  className,
}: {
  label: string;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      onCheckedChange={onToggle}
      className={cn(
        'shrink-0 transition-opacity',
        checked || selecting
          ? 'opacity-100'
          : 'touch:hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        className
      )}
    />
  );
}

export function ConfirmBulkDelete({
  open,
  onOpenChange,
  count,
  noun,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: [string, string];
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {count} {count === 1 ? noun[0] : noun[1]}?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={count === 0} onClick={onConfirm}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
