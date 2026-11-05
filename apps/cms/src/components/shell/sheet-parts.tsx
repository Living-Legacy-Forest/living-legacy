import { DrawerTitle } from '@/components/ui/drawer';

// Shared by the phone sheets the shell opens (More, Activity, Account), so
// they read as one set: a title with Done, then grouped iOS-style lists.

/** Rounded white group on the sheet's grey background. */
export const sheetGroupClass = 'bg-background divide-border/70 divide-y overflow-hidden rounded-xl';

/** One tappable row in a group: at least 44pt, body-sized text, dims while pressed. */
export const sheetRowClass =
  'flex min-h-11 w-full items-center gap-3 px-4 text-left text-[1.0625rem] transition-colors active:bg-muted [&_svg]:size-5.5';

export function SheetHeader({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pt-1 pb-2">
      <DrawerTitle className="text-[1.0625rem] font-semibold">{title}</DrawerTitle>
      <button
        type="button"
        onClick={onDone}
        className="text-brand -mr-2 min-h-11 px-2 text-[1.0625rem] font-semibold active:opacity-50"
      >
        Done
      </button>
    </div>
  );
}
