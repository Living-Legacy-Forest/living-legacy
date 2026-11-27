import { GridIcon, ListViewIcon } from '@/components/icons';
import type { ListView } from '@/components/list/view-switch';
import { cn } from '@/lib/utils';

/** The look of a choice that sits on a soft fill: lighter when off, stronger when on. */
export const choiceClass = (on: boolean) =>
  on
    ? 'bg-foreground/20 text-foreground'
    : 'bg-foreground/[0.07] text-muted-foreground hover:bg-foreground/10 hover:text-foreground';

/** A small round choice, for ticking a few of many. */
export const pillClass = (on: boolean) =>
  cn(
    'focus-visible:ring-ring rounded-full px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2',
    choiceClass(on)
  );

/** The List and Grid choice as two full-width labelled buttons, for a Display panel. */
export function ViewButtons({
  value,
  onChange,
}: {
  value: ListView;
  onChange: (next: ListView) => void;
}) {
  return (
    <div role="group" aria-label="View" className="grid grid-cols-2 gap-1">
      {(
        [
          ['list', 'List', ListViewIcon],
          ['grid', 'Grid', GridIcon],
        ] as const
      ).map(([next, label, Icon]) => (
        <button
          key={next}
          type="button"
          aria-pressed={value === next}
          onClick={() => onChange(next)}
          className={cn(
            'focus-visible:ring-ring flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors outline-none focus-visible:ring-2',
            choiceClass(value === next)
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
