/**
 * The building blocks of a list page (team, FAQs, redirects and the rest): a
 * list on the left and, on large screens, the chosen item in a pane on the
 * right. Smaller screens have no pane, so the same target opens in a dialog.
 *
 *   const pane = useListPane<Target>();
 *   <ListPageLayout>
 *     <ListColumn label="Team members" header={<SelectionBar … />}>…rows…</ListColumn>
 *     <PaneColumn label="Edit member">{pane.pane ? <PaneFrame …/> : <PaneEmpty …/>}</PaneColumn>
 *   </ListPageLayout>
 *   <ListDialog open={pane.dialog !== null} onClose={pane.closeDialog} …/>
 */
import { useState } from 'react';
import { PanelRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

/** Large screens show the pane; below this the target opens in a dialog. */
export const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/**
 * What the pane (large screens) or the dialog (smaller ones) is showing. Pages
 * pick their own target type, e.g. `{ kind: 'edit'; id } | { kind: 'new' }`.
 */
export function useListPane<T>() {
  const [pane, setPane] = useState<T | null>(null);
  const [dialog, setDialog] = useState<T | null>(null);
  return {
    pane,
    dialog,
    setPane,
    /** Shows the target where this screen shows things: pane or dialog. */
    open: (target: T) => (isDesktop() ? setPane(target) : setDialog(target)),
    closePane: () => setPane(null),
    closeDialog: () => setDialog(null),
  };
}

/** The bordered two-column frame: list, then pane from `lg` up. */
export function ListPageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  /** To size the columns differently, e.g. a narrower list beside a long form. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_minmax(0,1fr)]',
        className
      )}
    >
      {children}
    </div>
  );
}

/** The left column: a header (usually a SelectionBar) over the scrolling rows. */
export function ListColumn({
  label,
  header,
  children,
}: {
  label: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="flex min-h-0 flex-col lg:border-r">
      {header}
      {children}
    </section>
  );
}

/** The scrolling list of rows (ListRow), or wrap your own grouped sections. */
export function ListRows({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('min-h-0 flex-1 space-y-px overflow-y-auto p-1.5', className)}>{children}</ul>
  );
}

/** Shown in place of the rows when a search or filter matches nothing. */
export function NoMatches({
  children,
  clearLabel = 'Clear search',
  onClear,
}: {
  children: React.ReactNode;
  clearLabel?: string;
  onClear: () => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
      {children}
      <Button variant="ghost" size="sm" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}

/** The right column, large screens only. */
export function PaneColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="hidden min-h-0 flex-col lg:flex">
      {children}
    </section>
  );
}

/** The pane before anything is chosen. */
export function PaneEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PanelRightIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** A pane's title bar (with optional actions) over a scrolling, centred body. */
export function PaneFrame({
  title,
  actions,
  width = 'md',
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  width?: 'md' | 'lg';
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="min-w-0 truncate text-sm font-medium">{title}</span>
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className={cn('mx-auto', width === 'lg' ? 'max-w-lg' : 'max-w-md')}>{children}</div>
      </div>
    </>
  );
}

/**
 * A form's buttons in the pane: `start` (e.g. Delete) on the left, then
 * Cancel and the submit button passed as children.
 */
export function PaneActions({
  start,
  onCancel,
  children,
}: {
  start?: React.ReactNode;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {start && <div className="mr-auto">{start}</div>}
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      {children}
    </div>
  );
}

/** The same buttons in the dialog, where Cancel closes it. */
export function DialogActions({
  start,
  compact = false,
  children,
}: {
  start?: React.ReactNode;
  /**
   * On phones, one row with room left for the form, for a long form with several
   * actions. Cancel goes: swiping the sheet away or its close button does the same.
   */
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DialogFooter
      className={cn(
        compact &&
          'touch:[&_button]:min-h-11 flex-row flex-wrap items-center max-sm:*:data-[slot=button]:flex-1 sm:flex-nowrap'
      )}
    >
      {start && <div className="mr-auto">{start}</div>}
      <DialogClose
        render={
          <Button type="button" variant="outline" className={cn(compact && 'max-sm:hidden')} />
        }
      >
        Cancel
      </DialogClose>
      {children}
    </DialogFooter>
  );
}

/** The dialog the pane's content opens in on smaller screens. */
export function ListDialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        // Long forms scroll inside the dialog rather than running off the screen. Phones
        // get a sheet, which already does.
        className={cn(
          'md:max-h-[90svh] md:overflow-y-auto',
          size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md'
        )}
      >
        <DialogHeader>
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
