import * as React from 'react';

const glideEase = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * One highlight for a list of options (menu, select) instead of a fill on each item: it glides
 * from item to item under the pointer and jumps straight there for the keyboard. It follows Base
 * UI's data-highlighted, so it works however the item became active. Render it as the first
 * child of a positioned popup; it mounts with the popup and reads it as its parent.
 */
function GlideHighlight() {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const mark = ref.current;
    const popup = mark?.parentElement;
    if (!mark || !popup) return;
    let pointer = false;
    let shown = false;
    let clearTimer = 0;
    const onPointer = () => (pointer = true);
    const onKey = () => (pointer = false);

    const place = (resized = false) => {
      // Submenus are portalled, so anything highlighted in here belongs to this popup.
      const item = popup.querySelector<HTMLElement>('[data-highlighted]');
      window.clearTimeout(clearTimer);
      if (!item) {
        // A short grace keeps the highlight gliding across separators and gaps.
        clearTimer = window.setTimeout(
          () => {
            mark.style.opacity = '0';
            shown = false;
          },
          pointer ? 70 : 0
        );
        return;
      }
      // Measured against the popup, so items nested in groups or a list still line up. Divided
      // by the popup's scale, which is below 1 while it is still opening.
      const box = item.getBoundingClientRect();
      const frame = popup.getBoundingClientRect();
      const scale = frame.width / popup.offsetWidth || 1;
      const top = (box.top - frame.top) / scale + popup.scrollTop - popup.clientTop;
      const left = (box.left - frame.left) / scale + popup.scrollLeft - popup.clientLeft;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const glide = shown && pointer && !reduced && !resized;
      mark.style.transition = glide
        ? `translate 200ms ${glideEase}, height 200ms ${glideEase}, width 200ms ${glideEase}, opacity 100ms`
        : 'opacity 100ms';
      mark.style.translate = `${left}px ${top}px`;
      mark.style.width = `${box.width / scale}px`;
      mark.style.height = `${box.height / scale}px`;
      mark.style.opacity = '1';
      mark.dataset.tone = item.dataset.variant === 'destructive' ? 'danger' : '';
      shown = true;
    };

    const observer = new MutationObserver(() => place());
    // A select sizes itself to its trigger after it appears; re-measure in place when it does.
    const resize = new ResizeObserver(() => {
      if (shown) place(true);
    });
    resize.observe(popup);
    observer.observe(popup, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-highlighted'],
    });
    popup.addEventListener('pointermove', onPointer, true);
    popup.addEventListener('keydown', onKey, true);
    place();
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.clearTimeout(clearTimer);
      popup.removeEventListener('pointermove', onPointer, true);
      popup.removeEventListener('keydown', onKey, true);
    };
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      data-slot="glide-highlight"
      className="bg-accent data-[tone=danger]:bg-destructive/10 dark:data-[tone=danger]:bg-destructive/20 pointer-events-none absolute top-0 left-0 rounded-md opacity-0"
    />
  );
}

export { GlideHighlight };
