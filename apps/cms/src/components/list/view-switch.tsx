import { useRouteContext } from '@tanstack/react-router';
import { useState } from 'react';
import { GridIcon, List as ListIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { type ListView, rememberListView } from '@/lib/list-view';
import { cn } from '@/lib/utils';

export type { ListView };

/** Longer than the slowest item's delay plus its animation in styles.css. */
const SWITCH_MOTION_MS = 800;
let switchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Marks the page as mid-switch so the view being mounted settles in (styles.css). Set before
 * React renders, so the new items are inserted with it already present; cleared once they have
 * landed, so a later filter or page of results arrives without replaying it.
 */
function markSwitch(next: ListView) {
  const root = document.documentElement;
  root.dataset.listSwitch = next;
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => delete root.dataset.listSwitch, SWITCH_MOTION_MS);
}

/** A list page's List or Grid choice, remembered per page across visits. */
export function useListView(page: string, fallback: ListView = 'list') {
  const { listViews } = useRouteContext({ from: '/_app' });
  const [view, setView] = useState<ListView>(listViews[page] ?? fallback);
  const change = (next: ListView) => {
    if (next === view) return;
    markSwitch(next);
    setView(next);
    rememberListView(page, next);
  };
  return [view, change] as const;
}

const options = [
  ['list', 'List', ListIcon],
  ['grid', 'Grid', GridIcon],
] as const;

/** The List/Grid pair in a list page's toolbar. The highlight slides to the chosen one. */
export function ViewSwitch({
  value,
  onChange,
}: {
  value: ListView;
  onChange: (next: ListView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="bg-muted/60 relative flex items-center gap-0.5 rounded-lg p-0.5"
    >
      <span
        aria-hidden
        className={cn(
          'bg-background absolute top-0.5 left-0.5 size-7 rounded-md shadow-xs transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
          // One button's width plus the 2px gap between them.
          value === 'grid' && 'translate-x-[calc(100%+0.125rem)]'
        )}
      />
      {options.map(([next, label, Icon]) => (
        <Button
          key={next}
          variant="ghost"
          size="icon-sm"
          aria-label={`${label} view`}
          aria-pressed={value === next}
          title={`${label} view`}
          // The highlight behind is the background; the buttons only change colour.
          className="text-muted-foreground hover:text-foreground aria-pressed:text-foreground relative size-7 hover:bg-transparent active:bg-transparent dark:hover:bg-transparent dark:active:bg-transparent"
          onClick={() => onChange(next)}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}
