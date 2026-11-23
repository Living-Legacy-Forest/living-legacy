/** Shared row style: compact 28px rows, 13px medium text, muted icons. */
export const navItemClass =
  'h-7 gap-2.5 px-2 text-ui font-medium text-sidebar-foreground/80 transition-[width,height,padding,background-color] duration-100 hover:text-sidebar-foreground active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&_svg]:text-sidebar-foreground/55 hover:[&_svg]:text-sidebar-foreground/80 data-active:[&_svg]:text-sidebar-primary';

/**
 * Sections that are not built yet: quieter and inert, with no badge. Styled
 * rather than `disabled`, because the tooltip wrapper drops that attribute.
 */
export const navItemSoonClass =
  'cursor-default text-sidebar-foreground/40 hover:bg-transparent hover:text-sidebar-foreground/40 active:bg-transparent aria-disabled:opacity-100 [&_svg]:text-sidebar-foreground/30 hover:[&_svg]:text-sidebar-foreground/30';
