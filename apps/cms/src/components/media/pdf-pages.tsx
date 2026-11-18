import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

/** Pages shown; a longer document is read in full from "Open the PDF". */
const MAX_PAGES = 30;

type Doc = import('pdfjs-dist/legacy/build/pdf.mjs').PDFDocumentProxy;

/**
 * The pages of a PDF, drawn one by one as they scroll into view, so the library can show what a
 * document says without opening it. Uses the same library as thumbnails, loaded only when this
 * is asked for.
 */
export function PdfPages({ url }: { url: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let task: { destroy: () => Promise<void> } | null = null;
    let active = true;
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

  useEffect(() => {
    if (!holder.current) return;
    const measure = () => setWidth(Math.floor(holder.current?.clientWidth ?? 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);

  if (failed) {
    return <p className="text-muted-foreground text-sm">This PDF could not be shown here.</p>;
  }
  return (
    <div ref={holder} className="grid gap-3">
      {!doc ? (
        <Spinner />
      ) : (
        <>
          {Array.from({ length: Math.min(doc.numPages, MAX_PAGES) }, (_, i) => (
            <PdfPage key={i} doc={doc} number={i + 1} width={width} />
          ))}
          {doc.numPages > MAX_PAGES && (
            <p className="text-muted-foreground text-xs">
              Showing the first {MAX_PAGES} of {doc.numPages} pages.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** One page, drawn the first time it comes into view and again if the width changes. */
function PdfPage({ doc, number, width }: { doc: Doc; number: number; width: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  // Held until the page's size is known, so the box keeps its place while it is not drawn.
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    if (!box.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry?.isIntersecting && setVisible(true),
      { rootMargin: '400px' }
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !width || !canvas.current) return;
    let cancelled = false;
    let render: { cancel: () => void } | null = null;
    (async () => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const target = canvas.current;
      if (cancelled || !target) return;
      target.width = Math.round(viewport.width);
      target.height = Math.round(viewport.height);
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
  }, [visible, width, doc, number]);

  return (
    <div
      ref={box}
      style={{ aspectRatio: `1 / ${ratio}` }}
      className="bg-muted overflow-hidden rounded-md border shadow-xs"
    >
      <canvas ref={canvas} aria-label={`Page ${number}`} className="block size-full" />
    </div>
  );
}
