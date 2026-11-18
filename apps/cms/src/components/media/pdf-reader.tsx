import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { motionTokens } from '@/components/arc/lib/motion-tokens';
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

/**
 * A PDF read in place, one whole page at a time like a reader: arrows (or a swipe, or the arrow
 * keys once it has focus) turn the page, and it always fits the space it is given. `placeholder`
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
  const [page, setPage] = useState(1);
  // Which way the last turn went, so the new page arrives from that side.
  const [direction, setDirection] = useState(1);
  const swipe = useRef<number | null>(null);

  const count = doc?.numPages ?? 0;
  const go = (delta: number) => {
    const next = Math.min(count, Math.max(1, page + delta));
    if (next === page) return;
    setDirection(delta > 0 ? 1 : -1);
    setPage(next);
  };

  return (
    // The arrow keys and swipe are shortcuts: the Previous and Next buttons do everything, so the
    // viewer needs no widget role of its own, only to be focusable for the keys.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={count ? `${title}, page ${page} of ${count}` : title}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      data-pdf-reader=""
      className={cn(
        'focus-visible:ring-ring bg-muted/60 relative h-[72vh] min-h-96 overflow-hidden rounded-lg border outline-none focus-visible:ring-2',
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
        go(delta);
      }}
      onPointerDown={(e) => {
        swipe.current = e.clientX;
      }}
      onPointerUp={(e) => {
        const from = swipe.current;
        swipe.current = null;
        if (from !== null && Math.abs(e.clientX - from) > 50) go(e.clientX < from ? 1 : -1);
      }}
    >
      {/* Padding leaves room for the arrows and the counter; the page fits what is left. */}
      <div ref={stage} className="absolute inset-0 grid place-items-center px-14 pt-4 pb-12">
        {failed ? (
          <p className="text-muted-foreground text-sm">This PDF could not be shown here.</p>
        ) : !doc ? (
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
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <PdfPage
              key={page}
              doc={doc}
              number={page}
              width={size.width}
              height={size.height}
              direction={direction}
              reduced={reduced}
            />
          </AnimatePresence>
        )}
      </div>

      {count > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => go(-1)}
            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full shadow-sm"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Next page"
            disabled={page >= count}
            onClick={() => go(1)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full shadow-sm"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </>
      )}
      {count > 0 && (
        <p
          aria-live="polite"
          className="bg-background/80 text-muted-foreground absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-xs tabular-nums backdrop-blur-sm"
        >
          Page {page} of {count}
        </p>
      )}
    </div>
  );
}

/** One page, drawn to fit the space (the whole page, never cropped) and slid in from its side. */
function PdfPage({
  doc,
  number,
  width,
  height,
  direction,
  reduced,
}: {
  doc: Doc;
  number: number;
  width: number;
  height: number;
  direction: number;
  reduced: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!width || !height || !canvas.current) return;
    let cancelled = false;
    let render: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(width / base.width, height / base.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: fit * dpr });
      const target = canvas.current;
      if (cancelled || !target) return;
      target.width = Math.round(viewport.width);
      target.height = Math.round(viewport.height);
      setShape({ width: Math.round(base.width * fit), height: Math.round(base.height * fit) });
      const context = target.getContext('2d');
      if (!context) return;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, target.width, target.height);
      const task = page.render({ canvas: target, canvasContext: context, viewport });
      render = task;
      await task.promise.catch(() => {});
    })().catch(() => {});
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, number, width, height]);

  return (
    <motion.div
      custom={direction}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -48 }}
      transition={{ duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
      style={shape ? { width: shape.width, height: shape.height } : undefined}
      className="overflow-hidden rounded-[3px] bg-white shadow-md ring-1 ring-black/10"
    >
      <canvas ref={canvas} aria-label={`Page ${number}`} className="block size-full" />
    </motion.div>
  );
}
