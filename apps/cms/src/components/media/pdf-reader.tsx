import {
  AnimatePresence,
  type MotionValue,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Doc = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

/** The PDF library (large, with its own worker) loads here, only when a PDF's page is opened. */
function usePdfDocument(url: string) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let task: { destroy: () => Promise<void> } | null = null;
    let active = true;
    setDoc(null);
    setFailed(false);
    (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const loaded = await loading.promise;
        if (active) setDoc(loaded);
      } catch (error) {
        console.warn('[media] could not show the PDF', error);
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [url]);

  return { doc, failed };
}

/** The size of an element's content box, kept current. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

type Layout = 'single' | 'double';

/** A page drawn off screen at the size the book shows it, so a turn never waits on drawing. */
type Rendered = { canvas: HTMLCanvasElement; width: number; height: number };

type Renderer = {
  get: (page: number) => Promise<Rendered>;
  /** The drawn page if it is ready now, so a face can paint in the same frame it mounts. */
  peek: (page: number) => Rendered | undefined;
  /** Forget pages far from this one, which keeps memory flat on a long document. */
  trim: (around: number) => void;
};

async function drawPage(doc: Doc, number: number, boxW: number, boxH: number): Promise<Rendered> {
  const page = await doc.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const fit = Math.min(boxW / base.width, boxH / base.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale: fit * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { canvas, width: Math.round(base.width * fit), height: Math.round(base.height * fit) };
}

/** Pages drawn once for a document and box size; a new size starts a fresh set. */
function usePageRenderer(doc: Doc | null, boxW: number, boxH: number): Renderer | null {
  return useMemo(() => {
    if (!doc || !boxW || !boxH) return null;
    const entries = new Map<number, { promise: Promise<Rendered>; value?: Rendered }>();
    return {
      get(number) {
        let entry = entries.get(number);
        if (!entry) {
          const created: { promise: Promise<Rendered>; value?: Rendered } = {
            promise: drawPage(doc, number, boxW, boxH),
          };
          created.promise.then(
            (value) => {
              created.value = value;
            },
            () => {
              // Only this draw's own entry: a stale failure must not evict newer work.
              if (entries.get(number) === created) entries.delete(number);
            }
          );
          entries.set(number, created);
          entry = created;
        }
        return entry.promise;
      },
      peek: (number) => entries.get(number)?.value,
      trim(around) {
        for (const key of entries.keys()) if (Math.abs(key - around) > 5) entries.delete(key);
      },
    };
  }, [doc, boxW, boxH]);
}

/**
 * What is on show at a position. A single page is its own number. A two-page book starts with
 * the cover alone on the right, then pairs 2-3, 4-5 and so on, the last page alone on the left
 * when the count is even.
 */
function sides(index: number, layout: Layout, count: number) {
  if (layout === 'single') return { left: null, right: index };
  return {
    left: index === 0 ? null : 2 * index,
    right: 2 * index + 1 <= count ? 2 * index + 1 : null,
  };
}

/** The page a position is anchored to, so changing 1 page / 2 pages keeps your place. */
const pageAt = (index: number, layout: Layout) =>
  layout === 'single' ? index : Math.max(1, 2 * index);
const indexOf = (page: number, layout: Layout) =>
  layout === 'single' ? page : Math.floor(page / 2);

/**
 * After a drag, a page turn is a spring: it has no fixed length, so it settles from wherever a
 * flick leaves it, at the speed the finger had, and never overshoots (a leaf past flat would pass
 * through the page).
 */
// Set by stiffness and damping (a duration-based spring would ignore the velocity); 30 is just
// past critical damping for this stiffness, so it settles without overshoot.
const SPRING = { type: 'spring', stiffness: 220, damping: 30, mass: 1 } as const;
/**
 * From a button or a key there is no speed to carry on, and a spring would front-load the turn: the
 * leaf crosses the spine in a tenth of a second, then drifts down unseen. A sine ease-in-out
 * puts the middle of the turn in the middle of the time, keeps the speed even enough to follow, and
 * ends on an exact frame.
 */
const TURN = { duration: 0.68, ease: [0.37, 0, 0.63, 1] } as const;

/** How far the free half of a leaf trails the half on the spine, at its most, in degrees. */
const BEND = 14;
/** Finger travel before a press becomes a drag, and the speed of a flick, in px and px per ms. */
const DRAG_START = 8;
const FLICK = 0.3;

type Turn = { from: number; to: number; layout: Layout };

/** Where the leaf's angle starts and ends. One page lifts edge-on; two swing right over. */
function angles(layout: Layout, dir: number) {
  if (layout === 'double') return { start: 0, end: dir * -180 };
  return dir > 0 ? { start: 0, end: -90 } : { start: -90, end: 0 };
}

/** The shadow a leaf throws on the page under it: where it lifts from, then where it lands. */
function cast(angle: number, side: 'left' | 'right') {
  const p = Math.min(1, Math.abs(angle) / 180);
  const departs = angle < 0 ? 'right' : 'left';
  const amount =
    side === departs
      ? p < 0.5
        ? Math.sin(p * 2 * Math.PI)
        : 0
      : p > 0.5
        ? Math.sin((p - 0.5) * 2 * Math.PI)
        : 0;
  return amount * 0.32;
}

/**
 * How strong the 3D is at an angle. Mid-turn it is a real perspective; as the leaf comes to lie
 * flat (at either end) it fades out, because a leaf a degree short of flat is still a pixel
 * larger or smaller than the page it lands on, and would visibly settle when it is swapped.
 */
const PERSPECTIVE = 2400;
function perspectiveAt(angle: number) {
  const a = Math.abs(angle);
  const flat = Math.min(a, 180 - a);
  const k = Math.min(1, flat / 40);
  const eased = k * k * (3 - 2 * k);
  return PERSPECTIVE + (1 - eased) * 60 * PERSPECTIVE;
}

/**
 * Switching between 1 and 2 pages is rare, so it can be seen: the old layout scales toward the new
 * one's size as it fades, and the new one grows in from the old size. `scale` is new height / old.
 */
const morph = {
  enter: ({ scale, reduced }: { scale: number; reduced: boolean }) =>
    reduced ? { opacity: 0 } : { opacity: 0, scale: 1 / scale, filter: 'blur(3px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  leave: ({ scale, reduced }: { scale: number; reduced: boolean }) =>
    reduced ? { opacity: 0 } : { opacity: 0, scale, filter: 'blur(3px)' },
};
const MORPH = { duration: 0.3, ease: [0.23, 1, 0.32, 1] } as const;

type Drag = {
  id: number;
  x0: number;
  samples: { x: number; t: number }[];
  dir: number;
  started: boolean;
  turn: Turn | null;
  /** Let go before the turn was ready: it finishes as soon as it is. */
  released: number | null;
};

/**
 * A PDF read in place like a book: one page, or two side by side, and a page turns over its
 * spine. Drag a page and it follows your finger, then carries on with the speed you let go at;
 * the arrows and arrow keys turn it too. It always fits the space it is given. `placeholder`
 * (the first-page thumbnail) shows while the document loads.
 */
export function PdfReader({
  url,
  title,
  placeholder,
  className,
}: {
  url: string;
  title: string;
  placeholder?: string;
  className?: string;
}) {
  const { doc, failed } = usePdfDocument(url);
  const reduced = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const size = useSize(stage);
  const [chosen, setChosen] = useState<Layout>('single');
  const [page, setPage] = useState(1);
  const [ratio, setRatio] = useState(0.7071);
  const [turn, setTurn] = useState<Turn | null>(null);
  const rot = useMotionValue(0);
  const turning = useRef(false);
  const playing = useRef<{ stop: () => void } | null>(null);
  const drag = useRef<Drag | null>(null);
  // A turn asked for while another is playing waits its turn, so quick presses are not lost.
  const queued = useRef<number[]>([]);
  // Whose preparation of a turn is current, so a cancelled one never installs a leaf.
  const prep = useRef(0);

  const count = doc?.numPages ?? 0;
  // Two pages need room; a phone shows one whatever was chosen.
  const canDouble = size.width >= 400;
  // A turn keeps the layout it began in, even if the stage is resized under it.
  const layout: Layout = turn?.layout ?? (canDouble ? chosen : 'single');
  const index = indexOf(page, layout);
  const first = layout === 'single' ? 1 : 0;
  const last = layout === 'single' ? count : Math.floor(count / 2);

  // Every page is drawn to the first page's shape, so the book keeps one steady size.
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void doc.getPage(1).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (live) setRatio(v.width / v.height);
    });
    return () => {
      live = false;
    };
  }, [doc]);
  useEffect(() => () => playing.current?.stop(), []);

  const slotW = layout === 'double' ? size.width / 2 : size.width;
  const boxH = Math.floor(Math.min(size.height, slotW / ratio));
  // Even, so each half of a leaf lands on a whole pixel.
  const boxW = Math.floor((boxH * ratio) / 2) * 2;
  const renderer = usePageRenderer(doc, boxW, boxH);
  // The last height each layout had, to size the change from one to the other.
  const heights = useRef<Record<Layout, number>>({ single: 0, double: 0 });
  const other: Layout = layout === 'single' ? 'double' : 'single';
  const change = {
    scale: heights.current[other] && boxH ? boxH / heights.current[other] : 1,
    reduced,
  };
  useLayoutEffect(() => {
    heights.current[layout] = boxH;
  });
  // How far a finger travels for the leaf to go all the way over.
  const span = boxW * (layout === 'double' ? 1.2 : 0.8);

  // Keep the pages around this one ready, so the next turn starts at once.
  useEffect(() => {
    if (!renderer || count === 0) return;
    renderer.trim(page);
    for (const i of [index, index + 1, index - 1]) {
      if (i < first || i > last) continue;
      const s = sides(i, layout, count);
      for (const n of [s.left, s.right]) if (n !== null) renderer.get(n).catch(() => {});
    }
  }, [renderer, page, index, layout, count, first, last]);

  /** Puts the leaf at its start. Resolves with the turn, or null when there is nowhere to turn to. */
  const begin = async (dir: number): Promise<Turn | null> => {
    if (!renderer || turning.current) return null;
    const to = index + dir;
    if (to < first || to > last) return null;
    turning.current = true;
    const id = ++prep.current;
    // Draw what the turn shows first, so no face is blank while it moves.
    const shown = [sides(index, layout, count), sides(to, layout, count)];
    try {
      await Promise.all(
        shown
          .flatMap((s) => [s.left, s.right])
          .flatMap((n) => (n === null ? [] : [renderer.get(n)]))
      );
    } catch {
      // A page that will not draw: stay where we are, and let the next press try again.
      if (id === prep.current) turning.current = false;
      return null;
    }
    // Cancelled while drawing: nothing to install.
    if (id !== prep.current) return null;
    rot.set(angles(layout, dir).start);
    const next: Turn = { from: index, to, layout };
    setTurn(next);
    return next;
  };

  /** Lets the leaf go on to where it is headed, from the speed it has now. */
  const settle = (t: Turn, dir: number, commit: boolean, velocity = 0, timed = false) => {
    const { start, end } = angles(layout, dir);
    playing.current = animate(rot, commit ? end : start, {
      ...(timed ? TURN : { ...SPRING, velocity }),
      onComplete: () => {
        if (commit) setPage(pageAt(t.to, layout));
        setTurn(null);
        turning.current = false;
      },
    });
  };

  /** Runs the next waiting press, in the order they were made. */
  function drain() {
    const next = queued.current.shift();
    if (next !== undefined) void go(next);
  }

  async function go(delta: number) {
    // Nothing to turn until the document has pages.
    if (count === 0) return;
    if (drag.current?.started) return;
    if (turning.current) {
      queued.current.push(delta);
      return;
    }
    const dir = delta > 0 ? 1 : -1;
    if (reduced) {
      const to = Math.min(last, Math.max(first, index + dir));
      setPage(pageAt(to, layout));
      return;
    }
    const t = await begin(dir);
    if (t) settle(t, dir, true, 0, true);
    // Out of range (or cancelled): the press is dropped, the ones behind it still run.
    else drain();
  }

  // Once a turn has landed, the next one waits for a render so it starts from the new page.
  useEffect(() => {
    if (!turn) drain();
  }, [turn]);

  const finish = (d: Drag, t: Turn, dx: number) => {
    const { start, end } = angles(layout, d.dir);
    const progress = Math.min(1, Math.max(0, (-d.dir * dx) / span));
    const recent = d.samples.filter((s) => d.samples.at(-1)!.t - s.t <= 100);
    const a = recent[0]!;
    const b = recent.at(-1)!;
    const vx = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
    // A quick flick turns it however far it got, and a quick flick back puts it down again.
    const forward = -d.dir * vx;
    const commit = forward > FLICK || (progress > 0.5 && forward > -FLICK);
    // Carry the speed of the finger over, converted from px per ms to degrees per second.
    const velocity = ((-(end - start) * d.dir) / span) * vx * 1000;
    // Start from where the finger let go, which can be ahead of the last move.
    rot.set(start + (end - start) * progress);
    settle(t, d.dir, commit, velocity);
  };

  const label = (() => {
    const now = sides(index, layout, count);
    const numbers = [now.left, now.right].flatMap((n) => (n === null ? [] : [n]));
    return numbers.length === 2
      ? `Pages ${numbers[0]} and ${numbers[1]} of ${count}`
      : `Page ${numbers[0]} of ${count}`;
  })();

  return (
    // The arrow keys and drag are shortcuts: the Previous and Next buttons do everything, so the
    // viewer needs no widget role of its own, only to be focusable for the keys.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={count ? `${title}, ${label.toLowerCase()}` : title}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      data-pdf-reader=""
      // Sideways moves are ours; up and down still scroll the page.
      style={{ touchAction: 'pan-y' }}
      className={cn(
        'focus-visible:ring-ring bg-muted/60 relative h-[72vh] min-h-96 overflow-hidden rounded-lg outline-none select-none focus-visible:ring-2',
        className
      )}
      onKeyDown={(e) => {
        const delta =
          e.key === 'ArrowRight' || e.key === 'PageDown'
            ? 1
            : e.key === 'ArrowLeft' || e.key === 'PageUp'
              ? -1
              : 0;
        if (!delta) return;
        // The file page uses these keys to move between files; here they turn the page.
        e.preventDefault();
        e.stopPropagation();
        void go(delta);
      }}
      onPointerDown={(e) => {
        // One finger at a time, and never from the buttons: a second touch must not move the page.
        if (e.button !== 0 || drag.current || (e.target as HTMLElement).closest('button')) return;
        drag.current = {
          id: e.pointerId,
          x0: e.clientX,
          samples: [{ x: e.clientX, t: e.timeStamp }],
          dir: 0,
          started: false,
          turn: null,
          released: null,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        // A mouse let go outside the book before it took hold: there is no release to wait for.
        if (e.pointerType === 'mouse' && e.buttons === 0 && !d.started) {
          drag.current = null;
          return;
        }
        d.samples.push({ x: e.clientX, t: e.timeStamp });
        if (d.samples.length > 8) d.samples.shift();
        const dx = e.clientX - d.x0;
        if (!d.started) {
          if (Math.abs(dx) < DRAG_START || turning.current) return;
          d.started = true;
          d.dir = dx < 0 ? 1 : -1;
          // Keep hold of the finger even when it leaves the book.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // A pointer that has already gone: nothing to hold.
          }
          if (reduced) return;
          void begin(d.dir).then((t) => {
            d.turn = t;
            if (t && d.released !== null) finish(d, t, d.released);
          });
          return;
        }
        if (!d.turn) return;
        const { start, end } = angles(layout, d.dir);
        const progress = Math.min(1, Math.max(0, (-d.dir * dx) / span));
        rot.set(start + (end - start) * progress);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        drag.current = null;
        if (!d.started) return;
        // Speed is measured up to the moment of release: a finger held still has none.
        d.samples.push({ x: e.clientX, t: e.timeStamp });
        const dx = e.clientX - d.x0;
        if (reduced) {
          if (Math.abs(dx) > 50) void go(dx < 0 ? 1 : -1);
        } else if (d.turn) finish(d, d.turn, dx);
        else d.released = dx;
      }}
      onPointerCancel={(e) => {
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        drag.current = null;
        if (d.turn) settle(d.turn, d.dir, false);
        else if (d.started) {
          // Cancelled while the turn was still being prepared: drop it and free the lock.
          prep.current++;
          turning.current = false;
        }
      }}
    >
      {/* Padding leaves room for the arrows, the switch and the counter; the book fits the rest. */}
      <div ref={stage} className="absolute inset-0 grid place-items-center px-14 pt-12 pb-12">
        {failed ? (
          <p className="text-muted-foreground text-sm">This PDF could not be shown here.</p>
        ) : !doc || !renderer ? (
          placeholder ? (
            <div className="relative">
              <img
                src={placeholder}
                alt=""
                className="max-h-full max-w-full rounded-[3px] bg-white object-contain shadow-md ring-1 ring-black/10"
                style={{ maxHeight: size.height || undefined, maxWidth: size.width || undefined }}
              />
              <Spinner className="absolute inset-0 m-auto" />
            </div>
          ) : (
            <Spinner />
          )
        ) : (
          <AnimatePresence initial={false} mode="popLayout" custom={change}>
            <motion.div
              key={layout}
              custom={change}
              variants={morph}
              initial="enter"
              animate="show"
              exit="leave"
              transition={MORPH}
            >
              <Book
                layout={layout}
                renderer={renderer}
                box={{ width: boxW, height: boxH }}
                index={index}
                count={count}
                turn={turn}
                rot={rot}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {canDouble && count > 1 && (
        <div
          role="group"
          aria-label="Pages shown"
          className="bg-background/80 absolute top-3 right-3 z-20 flex gap-0.5 rounded-lg p-0.5 shadow-md backdrop-blur-sm"
        >
          {(['single', 'double'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="xs"
              variant={layout === option ? 'secondary' : 'ghost'}
              aria-pressed={layout === option}
              onClick={() => !turning.current && setChosen(option)}
            >
              {option === 'single' ? '1 page' : '2 pages'}
            </Button>
          ))}
        </div>
      )}
      {count > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Previous page"
            disabled={index <= first}
            onClick={() => void go(-1)}
            className="absolute top-1/2 left-2 z-20 -translate-y-1/2 rounded-full shadow-sm"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Next page"
            disabled={index >= last}
            onClick={() => void go(1)}
            className="absolute top-1/2 right-2 z-20 -translate-y-1/2 rounded-full shadow-sm"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </>
      )}
      {count > 0 && (
        <p
          aria-live="polite"
          className="bg-background/80 text-muted-foreground absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1 text-xs tabular-nums backdrop-blur-sm"
        >
          {label}
        </p>
      )}
    </div>
  );
}

/** Part of a page: all of it, or one half (the other half is clipped away). */
function Part({
  renderer,
  number,
  align,
  box,
  part,
  shade,
}: {
  renderer: Renderer;
  number: number | null;
  align: 'start' | 'end' | 'center';
  box: { width: number; height: number };
  part: 'all' | 'left' | 'right';
  /** How dark the leaf is as it tips from the light; drawn over what this part shows, overlap included. */
  shade: MotionValue<number>;
}) {
  const half = box.width / 2;
  // Each half reaches a pixel past the seam, so no hairline of the page below shows between them.
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: part === 'all' ? box.width : half + 1,
        height: box.height,
        marginLeft: part === 'right' ? -1 : 0,
      }}
    >
      {number !== null && (
        <div
          className="absolute top-0"
          style={{
            left: part === 'right' ? 1 - half : 0,
            width: box.width,
            height: box.height,
          }}
        >
          <PageFace renderer={renderer} number={number} align={align} />
        </div>
      )}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: shade }}
      />
    </div>
  );
}

/**
 * The open book. Underneath sit the pages a turn reveals; on top, the leaf being turned swings
 * on the spine. The leaf is two halves: the one on the spine turns rigidly, the other trails it
 * and bends like paper. It darkens as it tips from the light and throws a shadow on the page
 * below. A cover or a last page on its own sits in the middle, and the book slides to meet the
 * first spread as the cover opens.
 */
function Book({
  layout,
  renderer,
  box,
  index,
  count,
  turn,
  rot,
}: {
  layout: Layout;
  renderer: Renderer;
  box: { width: number; height: number };
  index: number;
  count: number;
  turn: Turn | null;
  rot: MotionValue<number>;
}) {
  const double = layout === 'double';
  const at = (i: number) => sides(i, layout, count);
  const dir = turn ? (turn.to > turn.from ? 1 : -1) : 0;
  const shade = useTransform(rot, (v) => Math.sin((Math.abs(v) * Math.PI) / 180) * 0.28);
  const bend = useTransform(
    rot,
    (v) => -Math.sign(v) * Math.sin((Math.abs(v) * Math.PI) / 180) * BEND
  );
  const castLeft = useTransform(rot, (v) => cast(v, 'left'));
  const castRight = useTransform(rot, (v) => cast(v, 'right'));

  // A page on its own is centred: the book is shifted half a page toward the empty side.
  const shift = useMotionValue(0);
  const offset = (i: number) => {
    if (!double) return 0;
    const s = at(i);
    return s.left === null ? -box.width / 2 : s.right === null ? box.width / 2 : 0;
  };
  const stageRef = useRef<HTMLDivElement>(null);
  const move = (v: number) => {
    if (!turn) return;
    if (stageRef.current) stageRef.current.style.perspective = `${perspectiveAt(v)}px`;
    const t = double ? Math.min(1, Math.abs(v) / 180) : 0;
    shift.set(offset(turn.from) + (offset(turn.to) - offset(turn.from)) * t);
  };
  useMotionValueEvent(rot, 'change', move);
  useLayoutEffect(() => {
    if (turn) move(rot.get());
    else shift.set(offset(index));
  });

  const from = turn ? at(turn.from) : null;
  const to = turn ? at(turn.to) : null;
  const under = !turn
    ? at(index)
    : double
      ? dir > 0
        ? { left: from!.left, right: to!.right }
        : { left: to!.left, right: from!.right }
      : dir > 0
        ? to!
        : from!;
  const front = !turn
    ? null
    : double
      ? dir > 0
        ? from!.right
        : from!.left
      : dir > 0
        ? from!.right
        : to!.right;
  const back = !turn || !double ? null : dir > 0 ? to!.left : to!.right;

  return (
    <motion.div
      style={{
        x: shift,
        width: box.width * (double ? 2 : 1),
        height: box.height,
      }}
    >
      {/* Plain CSS perspective, set as the leaf moves (see perspectiveAt). */}
      <div ref={stageRef} className="relative size-full" style={{ perspective: PERSPECTIVE }}>
        {(['left', 'right'] as const).map((side) => {
          if (!double && side === 'left') return null;
          const number = under[side];
          return (
            <div
              key={side}
              className="absolute top-0"
              style={{
                left: double && side === 'right' ? box.width : 0,
                width: box.width,
                height: box.height,
              }}
            >
              {number !== null && (
                <PageFace
                  key={number}
                  renderer={renderer}
                  number={number}
                  align={!double ? 'center' : side === 'left' ? 'end' : 'start'}
                />
              )}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  opacity: side === 'left' ? castLeft : castRight,
                  backgroundImage: `linear-gradient(to ${side === 'left' ? 'left' : 'right'}, black, transparent 70%)`,
                }}
              />
            </div>
          );
        })}

        {turn && (
          <Leaf
            double={double}
            dir={dir}
            box={box}
            renderer={renderer}
            front={front}
            back={back}
            rot={rot}
            shade={shade}
            bend={bend}
          />
        )}

        {/* The fold where the two pages meet. */}
        {double && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-8 -translate-x-1/2 bg-linear-to-r from-transparent via-black/10 to-transparent"
          />
        )}
      </div>
    </motion.div>
  );
}

const facing = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
} as const;

/** The page being turned, with its front and, over the spine, its back. */
function Leaf({
  double,
  dir,
  box,
  renderer,
  front,
  back,
  rot,
  shade,
  bend,
}: {
  double: boolean;
  dir: number;
  box: { width: number; height: number };
  renderer: Renderer;
  front: number | null;
  back: number | null;
  rot: MotionValue<number>;
  shade: MotionValue<number>;
  bend: MotionValue<number>;
}) {
  // Forward turns and a single page hinge on the leaf's left edge; turning back, on its right.
  const spineLeft = dir > 0 || !double;
  const half = box.width / 2;
  const opposite = (part: 'left' | 'right') => (part === 'left' ? 'right' : 'left');

  /** One face of one half. `flip` is the back, which is turned to face the other way. */
  const face = (number: number | null, part: 'all' | 'left' | 'right', flip: boolean) => (
    <div
      className="absolute inset-0 bg-white"
      style={{ ...facing, transform: flip ? 'rotateY(180deg)' : undefined }}
    >
      <Part
        renderer={renderer}
        number={number}
        box={box}
        part={part}
        shade={shade}
        align={!double ? 'center' : flip === dir > 0 ? 'end' : 'start'}
      />
    </div>
  );

  const hingePart = spineLeft ? 'left' : 'right';

  return (
    <motion.div
      className="absolute top-0 z-10"
      style={{
        left: double && dir > 0 ? box.width : 0,
        width: box.width,
        height: box.height,
        transformOrigin: spineLeft ? 'left center' : 'right center',
        transformStyle: 'preserve-3d',
        rotateY: rot,
        willChange: 'transform',
      }}
    >
      {double ? (
        <div
          className="absolute top-0"
          style={{
            left: spineLeft ? 0 : half,
            width: half,
            height: box.height,
            transformStyle: 'preserve-3d',
          }}
        >
          {face(front, hingePart, false)}
          {face(back, opposite(hingePart), true)}
          {/* The free half hangs off the seam and trails it, so the page curves as it lifts. */}
          <motion.div
            className="absolute top-0"
            style={{
              left: spineLeft ? half : -half,
              width: half,
              height: box.height,
              transformOrigin: spineLeft ? 'left center' : 'right center',
              transformStyle: 'preserve-3d',
              rotateY: bend,
            }}
          >
            {face(front, opposite(hingePart), false)}
            {face(back, hingePart, true)}
          </motion.div>
        </div>
      ) : (
        face(front, 'all', false)
      )}
    </motion.div>
  );
}

/** One page painted from the off-screen copy; a page already drawn shows in the frame it mounts. */
function PageFace({
  renderer,
  number,
  align,
}: {
  renderer: Renderer;
  number: number;
  align: 'start' | 'end' | 'center';
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let live = true;
    const paint = (page: Rendered) => {
      if (!live) return;
      target.width = page.canvas.width;
      target.height = page.canvas.height;
      target.getContext('2d')?.drawImage(page.canvas, 0, 0);
      setShape({ width: page.width, height: page.height });
    };
    const ready = renderer.peek(number);
    if (ready) paint(ready);
    else renderer.get(number).then(paint, () => {});
    return () => {
      live = false;
    };
  }, [renderer, number]);

  return (
    <div
      className={cn(
        'flex size-full items-center',
        align === 'end' ? 'justify-end' : align === 'start' ? 'justify-start' : 'justify-center'
      )}
    >
      <canvas
        ref={canvas}
        aria-label={`Page ${number}`}
        style={shape ? { width: shape.width, height: shape.height } : { display: 'none' }}
        className="block bg-white shadow-sm ring-1 ring-black/10"
      />
    </div>
  );
}
