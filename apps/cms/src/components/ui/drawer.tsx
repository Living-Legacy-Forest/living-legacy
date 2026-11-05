'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';

// Dialogs become this sheet on phones; their parts read it to restyle themselves.
// `dirty` is set once a form in the sheet is edited, so a stray swipe can't lose the edits.
const InSheetContext = React.createContext<{ dirty: React.RefObject<boolean> } | null>(null);

/** Whether the component sits inside a phone bottom sheet rather than a centred dialog. */
function useInSheet() {
  return React.useContext(InSheetContext) !== null;
}

type DrawerProps = Omit<DrawerPrimitive.Root.Props, 'children'> & { children?: React.ReactNode };
type DrawerContentProps = DrawerPrimitive.Popup.Props;

function Drawer({ children, onOpenChange, actionsRef, ...props }: DrawerProps) {
  const dirty = React.useRef(false);
  const sheet = React.useMemo(() => ({ dirty }), []);
  const ownActions = React.useRef<DrawerPrimitive.Root.Actions>(null);
  const actions = actionsRef ?? ownActions;
  const [confirming, setConfirming] = React.useState(false);

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      actionsRef={actions}
      onOpenChange={(open, details) => {
        // As on iOS, closing a sheet with unsaved edits asks first. Saving closes it
        // through `open`, which never comes through here.
        if (!open && dirty.current && details.reason !== 'imperative-action') {
          details.cancel();
          setConfirming(true);
          return;
        }
        onOpenChange?.(open, details);
      }}
      {...props}
    >
      <InSheetContext value={sheet}>
        {/* Keeps the focused field above the software keyboard. */}
        <DrawerPrimitive.VirtualKeyboardProvider>
          {children}
        </DrawerPrimitive.VirtualKeyboardProvider>
      </InSheetContext>
      {/* Outside this sheet's context, and any outer one's: its body is no form to guard. */}
      <InSheetContext value={null}>
        <DrawerPrimitive.Root open={confirming} onOpenChange={setConfirming}>
          <DrawerContent role="alertdialog">
            <DrawerBody className="grid gap-4 text-center">
              <div className="grid gap-1.5">
                <DrawerTitle>Discard changes?</DrawerTitle>
                <DrawerDescription>Your edits haven’t been saved.</DrawerDescription>
              </div>
              <div className={cn('-mx-4 flex flex-col gap-2 border-t px-4', sheetFooterClass)}>
                <Button
                  variant="destructive"
                  onClick={() => {
                    dirty.current = false;
                    setConfirming(false);
                    actions.current?.close();
                  }}
                >
                  Discard changes
                </Button>
                <DrawerPrimitive.Close render={<Button variant="outline" />}>
                  Keep editing
                </DrawerPrimitive.Close>
              </div>
            </DrawerBody>
          </DrawerContent>
        </DrawerPrimitive.Root>
      </InSheetContext>
    </DrawerPrimitive.Root>
  );
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

/**
 * An iOS page sheet: rises from the bottom edge, has a grabber, and follows the
 * finger when dragged down. The popup runs `--bleed` past the bottom edge so an
 * upward overdrag never shows a gap beneath it.
 */
function DrawerContent({ className, children, ...props }: DrawerContentProps) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(var(--backdrop-opacity)*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] [--backdrop-opacity:0.25] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 motion-reduce:transition-none dark:[--backdrop-opacity:0.6]"
      />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            'bg-popover text-popover-foreground relative -mb-(--bleed) flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem+var(--bleed))] w-full [transform:translateY(var(--drawer-swipe-movement-y))] flex-col overflow-hidden rounded-t-[1.25rem] pt-4 pb-(--bleed) text-sm shadow-[0_-1px_0] shadow-black/5 transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform outline-none [--bleed:3rem] data-ending-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-swiping:select-none motion-reduce:transition-none dark:shadow-white/10',
            // A sheet opened on top of this one pushes it back and dims it, as iOS stacks them.
            'origin-top transition-[transform,scale] after:pointer-events-none after:absolute after:inset-0 after:z-30 after:bg-black/0 after:transition-colors after:duration-[450ms] data-nested-drawer-open:scale-[0.94] data-nested-drawer-open:after:bg-black/25',
            className
          )}
          {...props}
        >
          <div
            aria-hidden
            data-slot="drawer-grabber"
            className="bg-muted-foreground/35 absolute top-1.5 left-1/2 z-20 h-1.25 w-9 -translate-x-1/2 rounded-full"
          />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

/** The sheet's scrolling body. Pads the home indicator so the last row clears it. */
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  const sheet = React.useContext(InSheetContext);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const body = ref.current;
    if (!sheet || !body) return;
    const { dirty } = sheet;
    dirty.current = false;
    // Only form fields count, so typing in a search box never asks to discard. Native
    // listeners, because React's events would also bubble in from sheets stacked on top.
    const inForm = (node: Node) => node instanceof Element && !!node.closest('form');
    const onEdit = (event: Event) => {
      if (event.target && inForm(event.target as Node)) dirty.current = true;
    };
    body.addEventListener('input', onEdit);
    body.addEventListener('change', onEdit);
    // Selects and switches fire no input event; they change an attribute instead.
    const observer = new MutationObserver((records) => {
      if (records.some((record) => inForm(record.target))) dirty.current = true;
    });
    observer.observe(body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'aria-checked'],
    });
    return () => {
      body.removeEventListener('input', onEdit);
      body.removeEventListener('change', onEdit);
      observer.disconnect();
      dirty.current = false;
    };
  }, [sheet]);

  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn(
        'mx-auto min-h-0 w-full overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className
      )}
      {...props}
      ref={ref}
    />
  );
}

/**
 * Pinned to the sheet's bottom edge so the actions stay in reach while a long form
 * scrolls. The negative offset cancels the body's bottom padding, which a sticky
 * box otherwise stays above.
 */
const sheetFooterClass =
  'bg-popover/90 sticky bottom-[calc(-1*max(1rem,env(safe-area-inset-bottom)))] z-10 -mb-[max(1rem,env(safe-area-inset-bottom))] rounded-none pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl';

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('text-foreground text-base font-medium', className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  sheetFooterClass,
  useInSheet,
  type DrawerContentProps,
  type DrawerProps,
};
