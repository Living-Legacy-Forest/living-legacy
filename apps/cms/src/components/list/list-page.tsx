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
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { DrawerClose, DrawerTitle } from '@/components/ui/drawer';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Phones: the sheet's top bar, where DialogActions moves the form's submit
 * button (Save, Create, Next), opposite Cancel, as an iOS sheet has them.
 */
const SheetSubmitSlot = createContext<HTMLElement | null>(null);

/** Submits the sheet's form from a button that has moved out of it into the top bar. */
function submitSheetForm(event: React.MouseEvent) {
  const button = (event.target as Element).closest('button[type="submit"]');
  if (!button) return;
  event.preventDefault();
  button.closest('[data-slot="drawer-content"]')?.querySelector('form')?.requestSubmit();
}

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
      data-slot="list-panes"
      className={cn(
        'grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_minmax(0,1fr)]',
        // Phones: no frame. The list is an iOS grouped list that ends with its rows.
        'max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0',
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

/**
 * The scrolling list of rows (ListRow), or wrap your own grouped sections.
 * On phones it is an iOS grouped list: one rounded group whose dividers start
 * at the text, or past the thumbnail when rows have one (`inset="media"`).
 */
export function ListRows({
  children,
  className,
  inset = 'text',
}: {
  children: React.ReactNode;
  className?: string;
  inset?: 'text' | 'media';
}) {
  return (
    <ul
      data-slot="list-rows"
      // 16px of padding, then a 60px thumbnail and a 12px gap before the text.
      style={{ '--row-inset': inset === 'media' ? '5.5rem' : '1rem' } as React.CSSProperties}
      className={cn(
        'no-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto p-1.5',
        'max-md:flex-none max-md:space-y-0 max-md:overflow-hidden max-md:rounded-[10px] max-md:bg-(--ios-cell) max-md:p-0',
        className
      )}
    >
      {children}
    </ul>
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
    <div
      data-slot="no-matches"
      className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm"
    >
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
  /** md for short forms, lg for most, xl for long forms with fields side by side. */
  width?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="min-w-0 truncate text-sm font-medium">{title}</span>
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {/* Relative, so anything positioned inside (screen-reader text in charts) scrolls with the
          pane instead of stretching the page. */}
      <div
        data-slot="pane-body"
        className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-6"
      >
        <div
          className={cn(
            'mx-auto',
            width === 'xl' ? 'max-w-2xl' : width === 'lg' ? 'max-w-lg' : 'max-w-md'
          )}
        >
          {children}
        </div>
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
    <div data-slot="form-actions" className="flex items-center justify-end gap-2">
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
  cancel = true,
  children,
}: {
  start?: React.ReactNode;
  /** Off for a step with nothing left to cancel, such as showing what was just created. */
  cancel?: boolean;
  /**
   * On phones, one row with room left for the form, for a long form with several
   * actions. Cancel goes: swiping the sheet away or its close button does the same.
   */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const slot = useContext(SheetSubmitSlot);
  const isPhone = useIsMobile();
  const barRef = useRef<HTMLDivElement>(null);

  // A sheet's bar holds one short word, as iOS's does: "Add location" or
  // "Create event" reads as Add or Create there, and in full at the form's end.
  useLayoutEffect(() => {
    const button = barRef.current?.querySelector('button[type=submit]');
    if (!button) return;
    const words = (button.textContent ?? '').trim().split(/\s+/);
    if (words.length > 1 && words[0]) {
      button.setAttribute('data-bar-label', words[0]);
      // The short word is drawn by CSS; the full label stays the accessible name.
      button.setAttribute('aria-label', words.join(' '));
    } else {
      button.removeAttribute('data-bar-label');
      button.removeAttribute('aria-label');
    }
  });

  // Phones: the submit button joins Cancel in the sheet's top bar, as plain
  // tint-coloured text (no fill, and no gradient image from the raised style). Everything else (Back, Next, Preview, Delete) stays at
  // the end of the form. The children render in both places, each showing its part.
  if (isPhone && slot) {
    return (
      <>
        {createPortal(
          <div
            ref={barRef}
            data-slot="sheet-submit"
            onClickCapture={submitSheetForm}
            className="[&>button]:text-tint! flex items-center [&>*:not(button[type=submit])]:hidden [&>button]:h-11 [&>button]:border-0 [&>button]:bg-transparent! [&>button]:bg-none! [&>button]:px-0 [&>button]:text-[1.0625rem] [&>button]:font-semibold [&>button]:shadow-none [&>button]:active:opacity-50 [&>button]:disabled:opacity-40"
          >
            {children}
          </div>,
          slot
        )}
        <div className="mt-8 flex flex-wrap items-center gap-2 [&_button]:min-h-11 [&_button[type=submit]]:hidden">
          {start && <div className="mr-auto">{start}</div>}
          {children}
        </div>
      </>
    );
  }

  return (
    <DialogFooter
      className={cn(
        'touch:[&_button]:min-h-11',
        compact &&
          'touch:[&_button]:min-h-11 flex-row flex-wrap items-center max-sm:*:data-[slot=button]:flex-1 sm:flex-nowrap'
      )}
    >
      {start && <div className="mr-auto">{start}</div>}
      {cancel && (
        <DialogClose
          render={
            <Button type="button" variant="outline" className={cn(compact && 'max-sm:hidden')} />
          }
        >
          Cancel
        </DialogClose>
      )}
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
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** A badge above the title on wider screens; a phone sheet's bar has no room. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isPhone = useIsMobile();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        // Phones have Cancel in the sheet's top bar instead of a close button.
        showCloseButton={!isPhone}
        // Long forms scroll inside the dialog rather than running off the screen. Phones
        // get a sheet, which already does. No position class here: it would replace the
        // dialog's own `fixed` and drop it into the page.
        className={cn(
          'no-scrollbar md:max-h-[90svh] md:overflow-y-auto',
          size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md'
        )}
      >
        {isPhone ? (
          <>
            {/* An iOS sheet's bar: Cancel, the title, and the form's submit button. */}
            <div
              data-slot="sheet-header"
              className="sticky -top-2 z-20 -mx-4 -mt-2 grid grid-cols-[minmax(4.5rem,1fr)_auto_minmax(4.5rem,1fr)] items-center gap-2 bg-(--ios-grouped)/85 px-4 pt-2 pb-1 backdrop-blur-xl"
            >
              <DrawerClose
                render={
                  <button
                    type="button"
                    className="text-tint min-h-11 justify-self-start text-[1.0625rem] active:opacity-50"
                  />
                }
              >
                Cancel
              </DrawerClose>
              <DrawerTitle className="max-w-[52vw] truncate text-center text-[1.0625rem] font-semibold text-nowrap!">
                {title}
              </DrawerTitle>
              <div ref={setSlot} className="flex justify-self-end" />
            </div>
            {description && (
              <DialogDescription className="text-center text-[0.9375rem] text-(--ios-secondary)">
                {description}
              </DialogDescription>
            )}
          </>
        ) : (
          <DialogHeader>
            {icon}
            <DialogTitle className="leading-snug">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <SheetSubmitSlot value={slot}>{children}</SheetSubmitSlot>
      </DialogContent>
    </Dialog>
  );
}
