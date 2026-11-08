// A page's actions in the phone top bar, the way a UIKit navigation bar holds
// them: Edit (or Done) on the left, then the bell, … and + on the right. Pages
// keep their own buttons for wider screens (hidden below md) and render this as
// well; it shows only on phones, where it moves into AppHeader's slots.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontalIcon, PlusIcon } from '@/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type PageMenuItem = { label: string; onClick: () => void; destructive?: boolean };

type AddAction = { label: string; onClick: () => void } | { label: string; items: PageMenuItem[] };

/** Text and icon buttons in the bar: the tint colour, 44pt to tap, dimmed while pressed. */
const barButton =
  'text-tint flex min-h-11 min-w-11 items-center justify-center px-2 text-[1.0625rem] active:opacity-50 disabled:opacity-40';

function MenuButton({
  label,
  items,
  children,
}: {
  label: string;
  items: PageMenuItem[];
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} className={barButton}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            variant={item.destructive ? 'destructive' : 'default'}
            className="min-h-11 text-[1.0625rem]"
            onClick={item.onClick}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageActions({
  edit,
  add,
  more,
}: {
  /** Left of the top bar: Edit, or Done while in Edit mode. */
  edit?: { editing: boolean; onToggle: () => void };
  /** The + button: one action, or a menu when there are several. */
  add?: AddAction;
  /** The … menu, for anything else (Bulk update, Export). */
  more?: PageMenuItem[];
}) {
  const isMobile = useIsMobile();
  const [slots, setSlots] = useState<{ start: Element | null; end: Element | null }>({
    start: null,
    end: null,
  });

  // The header renders the slots; it is mounted before the page, so they exist.
  useEffect(() => {
    if (!isMobile) return;
    setSlots({
      start: document.querySelector('[data-slot="page-actions-start"]'),
      end: document.querySelector('[data-slot="page-actions-end"]'),
    });
  }, [isMobile]);

  if (!isMobile || !slots.end) return null;

  const editButton = edit && (
    <button
      type="button"
      onClick={edit.onToggle}
      className={cn(barButton, edit.editing && 'font-semibold')}
    >
      {edit.editing ? 'Done' : 'Edit'}
    </button>
  );

  return (
    <>
      {/* A page below a tab has the back link on the left; Edit then joins the right. */}
      {editButton && slots.start && createPortal(editButton, slots.start)}
      {createPortal(
        <>
          {editButton && !slots.start && editButton}
          {more && more.length > 0 && (
            <MenuButton label="More actions" items={more}>
              <MoreHorizontalIcon aria-hidden className="size-6" />
            </MenuButton>
          )}
          {add &&
            ('items' in add ? (
              <MenuButton label={add.label} items={add.items}>
                <PlusIcon aria-hidden className="size-6" />
              </MenuButton>
            ) : (
              <button
                type="button"
                aria-label={add.label}
                onClick={add.onClick}
                className={barButton}
              >
                <PlusIcon aria-hidden className="size-6" />
              </button>
            ))}
        </>,
        slots.end
      )}
    </>
  );
}
