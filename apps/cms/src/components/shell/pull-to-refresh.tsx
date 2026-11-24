// Pull to refresh on phones, as iOS lists have it: at the top of a page, the page follows a
// downward drag (with growing resistance) and a spinner shows in the gap. Let go past the mark
// and the page holds open while its data reloads, then settles back. The page's own rubber band
// is off (styles.css), so nothing native competes with this.
//
// Every move writes transform and opacity straight to the elements: no React render per frame.
import { useRouter } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { PHONE_QUERY } from '@/hooks/use-mobile';
import { isEditorPath } from '@/lib/nav';

/** How far the page travels, after resistance, before letting go refreshes. */
const TRIGGER = 64;
/** Where the page rests while it refreshes: room for the spinner. */
const HOLD = 52;
/** Movement before the drag picks an axis; a sideways one (a row's swipe) is left alone. */
const SLOP = 8;
/** iOS's sheet curve: quick to leave, gentle to land. */
const SETTLE = 'transform 450ms cubic-bezier(0.32, 0.72, 0, 1)';

/** Resistance that grows with distance, as iOS's rubber band: never quite stops. */
function rubberband(distance: number, dimension: number, constant = 0.55) {
  return (distance * dimension * constant) / (dimension + constant * distance);
}

export function PullToRefresh({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    const indicator = indicatorRef.current;
    if (!content || !indicator) return;
    // A phone (as useIsMobile) with a touch screen: a narrow desktop window has no pull.
    const phone = window.matchMedia(PHONE_QUERY);
    const touch = window.matchMedia('(hover: none)');

    let startX = 0;
    let startY = 0;
    let axis: 'down' | 'other' | null = null;
    let offset = 0;
    let tracking = false;
    let refreshing = false;

    const paint = (y: number, transition: string) => {
      content.style.transition = transition;
      indicator.style.transition = transition ? `${transition}, opacity 200ms ease` : 'none';
      content.style.transform = y ? `translateY(${y}px)` : '';
      // The spinner rides in the gap, and fills in as the pull nears the mark.
      indicator.style.transform = `translateY(${Math.max(0, y - HOLD) / 2}px) scale(${0.6 + 0.4 * Math.min(1, y / TRIGGER)})`;
      indicator.style.opacity = refreshing ? '1' : String(Math.min(1, y / TRIGGER) ** 2);
    };

    const canStart = (target: EventTarget | null) => {
      if (!phone.matches || !touch.matches || refreshing || window.scrollY > 0) return false;
      if (isEditorPath(window.location.pathname)) return false;
      // An open sheet or dialog owns the touch, and so do fields, editors and maps.
      if (document.querySelector('[role="dialog"], [data-slot="drawer-content"]')) return false;
      const el = target instanceof Element ? target : null;
      return !el?.closest(
        'input, textarea, select, [contenteditable="true"], .maplibregl-map, [data-no-pull]'
      );
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      tracking = event.touches.length === 1 && !!touch && canStart(event.target);
      if (!tracking || !touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      axis = null;
      offset = 0;
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!tracking || !touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!axis) {
        if (Math.hypot(dx, dy) < SLOP) return;
        axis = dy > 0 && dy > Math.abs(dx) ? 'down' : 'other';
      }
      // The page scrolled after all (momentum), or the drag went another way: let it be.
      if (axis !== 'down' || window.scrollY > 0) {
        if (offset) paint(0, SETTLE);
        tracking = false;
        offset = 0;
        return;
      }
      // Direct manipulation: the page is the finger, less the resistance. No easing.
      offset = rubberband(Math.max(0, dy - SLOP), window.innerHeight);
      paint(offset, '');
    };

    const onEnd = async () => {
      if (!tracking) return;
      tracking = false;
      if (offset < TRIGGER) {
        offset = 0;
        paint(0, SETTLE);
        return;
      }
      refreshing = true;
      paint(HOLD, SETTLE);
      try {
        // At least a moment, so a quick reload still reads as one.
        await Promise.all([router.invalidate(), new Promise((r) => setTimeout(r, 500))]);
      } finally {
        refreshing = false;
        offset = 0;
        paint(0, SETTLE);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [router]);

  return (
    <>
      {/* Just under the top bar, behind the page until the page moves down off it. */}
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[calc(2.75rem+env(safe-area-inset-top)+0.875rem)] z-0 flex justify-center opacity-0 md:hidden"
      >
        <Spinner className="text-muted-foreground size-6" />
      </div>
      <div ref={contentRef} className={className}>
        {children}
      </div>
    </>
  );
}
