import { motion } from 'motion/react';
import { MoreHorizontalIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSortLayout } from '@/lib/sort-motion';
import { cn } from '@/lib/utils';
import { type RowMenuItem, rowActions } from './list-row';

/** The grid a list page shows instead of its rows when it is in grid view. */
export function ListCards({
  children,
  className,
}: {
  children: React.ReactNode;
  /** For a grid inside a section that scrolls with its page rather than on its own. */
  className?: string;
}) {
  // Cards stop growing at 21rem, so a card keeps its size when the editor opens beside the list
  // and the grid has fewer columns, instead of stretching as the layout moves.
  return (
    <ul
      data-slot="list-cards"
      className={cn(
        'grid min-h-0 flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(16rem,21rem))] gap-4 overflow-y-auto p-4 max-md:p-0',
        className
      )}
    >
      {children}
    </ul>
  );
}

/**
 * One item as a card: an optional cover, the title, then whatever the page puts under it. The
 * menu holds the same actions as the row's (Open, the page's items, then the red group), so
 * nothing is only reachable from one view.
 */
export function ListCard({
  title,
  image,
  icon,
  imagePosition = 'center',
  current = false,
  onOpen,
  menuOpen,
  link,
  previews,
  menu = [],
  remove,
  largeTitle = false,
  children,
}: {
  title: string;
  /**
   * The cover's URL. Leave it out for pages with nothing to picture; null keeps the cover and
   * shows `icon` in it, so cards with and without an image line up.
   */
  image?: string | null;
  icon?: React.ReactNode;
  /** `top` keeps faces in frame when a portrait is cropped to the cover. */
  imagePosition?: 'center' | 'top';
  /** The card open in the pane. */
  current?: boolean;
  onOpen: () => void;
  /** What the menu's Open does, where that differs from a click on the card (a click can toggle). */
  menuOpen?: () => void;
  /** Renders the title as a link (so it opens in a new tab too) instead of a button. */
  link?: (props: { className: string; children: React.ReactNode }) => React.ReactNode;
  /** A click shows a preview rather than the edit form, so the menu says Preview. */
  previews?: boolean;
  menu?: RowMenuItem[];
  /** The delete action, last in the menu as the row's swipe is. */
  remove?: { label: string; onAction: () => void };
  /** For cards whose title is the main thing: larger, and wraps to two lines instead of cutting off. */
  largeTitle?: boolean;
  children?: React.ReactNode;
}) {
  const { actions, destructive } = rowActions({
    onOpen: menuOpen ?? onOpen,
    previews,
    items: menu,
    swipe: remove,
  });
  const sortLayout = useSortLayout();
  // The title's ::after covers the card, so a click anywhere opens it; the menu sits above.
  const titleClass =
    "text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none " +
    (largeTitle ? 'text-base leading-snug font-semibold' : 'text-ui font-medium');
  const titleText = <span className={largeTitle ? 'line-clamp-2' : 'block truncate'}>{title}</span>;

  return (
    <motion.li
      {...sortLayout}
      data-slot="list-card"
      className={cn(
        'group/card bg-muted/50 has-[:focus-visible]:ring-ring/50 hover:bg-muted/80 has-[[data-popup-open]]:bg-muted/80 relative flex flex-col overflow-hidden rounded-xl transition-colors has-[:focus-visible]:ring-2 motion-reduce:transition-none',
        current &&
          'bg-foreground/10 hover:bg-foreground/10 has-[[data-popup-open]]:bg-foreground/10'
      )}
    >
      {image !== undefined && (
        <div className="bg-muted relative aspect-[16/10] overflow-hidden">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              className={cn(
                'size-full object-cover transition-transform duration-300 ease-out group-hover/card:scale-[1.03] group-has-[[data-popup-open]]/card:scale-[1.03] motion-reduce:transition-none',
                imagePosition === 'top' && 'object-top'
              )}
            />
          ) : (
            <span className="text-muted-foreground/60 flex size-full items-center justify-center [&_svg]:size-7">
              {icon}
            </span>
          )}
        </div>
      )}
      <div
        className={cn('flex min-w-0 flex-1 flex-col gap-1.5 p-3', image === undefined && 'pr-11')}
      >
        {link ? (
          link({ className: titleClass, children: titleText })
        ) : (
          <button type="button" onClick={onOpen} className={titleClass}>
            {titleText}
          </button>
        )}
        {children}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={`Actions for ${title}`}
              className="touch:opacity-100 absolute top-2 right-2 z-10 opacity-0 shadow-xs group-hover/card:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((item) => (
            <DropdownMenuItem key={item.label} disabled={item.disabled} onClick={item.onSelect}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
          {destructive.length > 0 && <DropdownMenuSeparator />}
          {destructive.map((item) => (
            <DropdownMenuItem
              key={item.label}
              variant="destructive"
              disabled={item.disabled}
              onClick={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}

/** A small muted line under a card's title. */
export function CardMeta({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground truncate text-xs">{children}</span>;
}
