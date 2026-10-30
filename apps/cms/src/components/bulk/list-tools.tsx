import { useState } from 'react';
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
  return (
    <div className="relative w-full sm:w-56">
      <SearchIcon
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
      />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-muted/60 placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-ring h-8 w-full rounded-md pr-2 pl-8 text-[13px] outline-none focus-visible:ring-1"
      />
    </div>
  );
}

/** True when any of the values contains the query, ignoring case. */
export function matchesSearch(query: string, values: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  return !q || values.some((v) => v?.toLowerCase().includes(q));
}

/** Ticked rows. `ids` are the rows that still exist, so deleted ones drop out. */
export function useSelection(ids: string[]) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const checkedIds = ids.filter((id) => checked.has(id));

  return {
    checkedIds,
    isChecked: (id: string) => checked.has(id),
    toggle: (id: string) =>
      setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    set: (next: string[]) => setChecked(new Set(next)),
    clear: () => setChecked(new Set()),
  };
}

export type Selection = ReturnType<typeof useSelection>;

/** The list header: a select-all box, then either the count or the selection's actions. */
export function SelectionBar({
  selection,
  visibleIds,
  title,
  total,
  pending,
  onDelete,
}: {
  selection: Selection;
  visibleIds: string[];
  title: string;
  total: number;
  pending: boolean;
  onDelete: () => void;
}) {
  const count = selection.checkedIds.length;
  const allChecked = visibleIds.length > 0 && visibleIds.every(selection.isChecked);
  const filtered = visibleIds.length !== total;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-3">
      <Checkbox
        aria-label={allChecked ? 'Clear selection' : 'Select all shown'}
        checked={allChecked}
        disabled={visibleIds.length === 0}
        onCheckedChange={() => (allChecked ? selection.clear() : selection.set(visibleIds))}
      />
      {count > 0 ? (
        <>
          <span className="mr-auto text-[13px]">{count} selected</span>
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
          <span className="text-[13px] font-medium">{filtered ? 'Shown' : title}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filtered ? `${visibleIds.length} of ${total}` : total}
          </span>
        </>
      )}
    </div>
  );
}

/** A row's tick box: hidden until hover, and always shown once anything is ticked. */
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
          : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
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

/** The desktop pane around a bulk form: title bar and a scrolling, centred body. */
export function BulkPane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center border-b px-3">
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-lg">{children}</div>
      </div>
    </>
  );
}
