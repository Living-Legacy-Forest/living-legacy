import * as React from 'react';
import { cn } from '@/lib/utils';

const glideEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * The part of an item that its scrolling or clipping ancestors (inside the list) leave visible.
 * The highlight sits outside them, so without this it would paint over whatever the item has
 * scrolled under, such as the sidebar's search box.
 */
function visibleBox(item: HTMLElement, container: HTMLElement) {
  const box = item.getBoundingClientRect();
  let { top, bottom, left, right } = box;
  for (let el = item.parentElement; el && el !== container; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (!/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) continue;
    const frame = el.getBoundingClientRect();
    top = Math.max(top, frame.top);
    bottom = Math.min(bottom, frame.bottom);
    left = Math.max(left, frame.left);
    right = Math.min(right, frame.right);
  }
  return { box, top, bottom, left, right };
}

type GlideHighlightProps = {
  /**
   * `active` follows the item a list marks as active (menus, selects, command lists), from
   * pointer or keyboard. `hover` follows the pointer over `selector` items (navigation, list
   * rows), on screens with a real hover only.
   */
  follow?: 'active' | 'hover';
  /** The active item for `active`; the items to follow for `hover`. */
  selector?: string;
  /** Rendered as a list item when the parent is a list, which can only hold list items. */
  as?: 'span' | 'li';
  className?: string;
};

/**
 * One highlight for a list instead of a fill on each item: it glides from item to item under
 * the pointer and jumps straight there for the keyboard. Render it as the first child of the
 * list; it mounts with the list and reads it as its parent. Items must be positioned (`relative`)
 * so they paint above it.
 */
function GlideHighlight({
  follow = 'active',
  selector = follow === 'active' ? '[data-highlighted]' : '',
  as: Tag = 'span',
  className,
}: GlideHighlightProps) {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const mark = ref.current;
    const container = mark?.parentElement;
    if (!mark || !container) return;
    if (follow === 'hover' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    let pointer = false;
    let current: HTMLElement | null = null;
    let clearTimer = 0;

    const hide = (delay: number) => {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        mark.style.opacity = '0';
        current = null;
      }, delay);
    };

    /** Moves onto an item: a glide from the last one, or a jump when there was none. */
    const show = (item: HTMLElement, jump = false) => {
      window.clearTimeout(clearTimer);
      // Measured against the container, so items nested in groups still line up. Divided by its
      // scale, which is below 1 while a popup is still opening.
      const box = item.getBoundingClientRect();
      const frame = container.getBoundingClientRect();
      const scale = frame.width / container.offsetWidth || 1;
      const top = (box.top - frame.top) / scale + container.scrollTop - container.clientTop;
      const left = (box.left - frame.left) / scale + container.scrollLeft - container.clientLeft;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const glide = current !== null && pointer && !jump && !reduced;
      mark.style.transition = glide
        ? `translate 200ms ${glideEase}, height 200ms ${glideEase}, width 200ms ${glideEase}, opacity 100ms`
        : 'opacity 100ms';
      mark.style.translate = `${left}px ${top}px`;
      mark.style.width = `${box.width / scale}px`;
      mark.style.height = `${box.height / scale}px`;
      // Cut away whatever a scrolled list hides, or hide it all when the item is out of view.
      const seen = visibleBox(item, container);
      const cut = (px: number) => (px > 0.5 ? px / scale : 0);
      const [cutTop, cutRight, cutBottom, cutLeft] = [
        cut(seen.top - box.top),
        cut(box.right - seen.right),
        cut(box.bottom - seen.bottom),
        cut(seen.left - box.left),
      ];
      const clipped = cutTop || cutRight || cutBottom || cutLeft;
      mark.style.clipPath = clipped
        ? `inset(${cutTop}px ${cutRight}px ${cutBottom}px ${cutLeft}px)`
        : '';
      mark.style.opacity = seen.bottom <= seen.top || seen.right <= seen.left ? '0' : '1';
      mark.dataset.tone = item.dataset.variant === 'destructive' ? 'danger' : '';
      current = item;
    };

    const cleanups: (() => void)[] = [];
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void
    ) => {
      container.addEventListener(type, handler, true);
      cleanups.push(() => container.removeEventListener(type, handler, true));
    };

    if (follow === 'active') {
      const place = (jump = false) => {
        // Submenus are portalled, so anything active in here belongs to this list.
        const item = container.querySelector<HTMLElement>(selector);
        // A short grace keeps the highlight gliding across separators and gaps.
        if (item) show(item, jump);
        else hide(pointer ? 70 : 0);
      };
      listen('pointermove', () => (pointer = true));
      listen('keydown', () => (pointer = false));
      // A filtered list (cmdk) reorders its items: re-measure in place rather than glide.
      const observer = new MutationObserver((records) =>
        place(records.some((record) => record.type === 'childList'))
      );
      observer.observe(container, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-highlighted', 'data-selected'],
      });
      cleanups.push(() => observer.disconnect());
      place();
    } else {
      pointer = true;
      listen('pointerover', (event) => {
        const item = (event.target as Element).closest<HTMLElement>(selector);
        if (item && container.contains(item)) {
          if (item !== current) show(item);
          else window.clearTimeout(clearTimer);
        } else if (current) hide(70);
      });
      // pointerleave doesn't bubble, so it is only heard from the container itself.
      const onLeave = () => hide(0);
      container.addEventListener('pointerleave', onLeave);
      cleanups.push(() => container.removeEventListener('pointerleave', onLeave));
      // A scroll inside the container moves the item from under a still highlight.
      listen('scroll', () => {
        if (current) show(current, true);
      });
    }

    // A select sizes itself to its trigger after it appears; rows grow and shrink. Re-measure.
    const resize = new ResizeObserver(() => {
      if (current?.isConnected) show(current, true);
    });
    resize.observe(container);
    cleanups.push(() => resize.disconnect());

    return () => {
      window.clearTimeout(clearTimer);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [follow, selector]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      aria-hidden
      role={Tag === 'li' ? 'none' : undefined}
      data-slot="glide-highlight"
      className={cn(
        'bg-accent data-[tone=danger]:bg-destructive/10 dark:data-[tone=danger]:bg-destructive/20 pointer-events-none absolute top-0 left-0 rounded-md opacity-0',
        className
      )}
    />
  );
}

export { GlideHighlight };
