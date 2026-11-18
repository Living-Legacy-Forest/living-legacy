/**
 * The first page of a PDF as a JPEG, for the library's thumbnail. Made in the browser at upload,
 * like an image's smaller copies, so the server never has to render anything. The PDF library
 * (large, with its own worker) loads only when a PDF is uploaded. Best effort: a locked,
 * damaged or unusual file gives null and simply keeps the generic cover.
 */
export async function pdfCover(file: File, width = 640): Promise<File | null> {
  try {
    const [pdfjs, worker] = await Promise.all([
      // The legacy build, which runs on browsers a few versions behind as well as current ones.
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return null;
      // A page is paper: JPEG has no transparency, and most PDFs leave the background unpainted.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.82)
      );
      return blob ? new File([blob], 'cover.jpg', { type: 'image/jpeg' }) : null;
    } finally {
      void task.destroy();
    }
  } catch (error) {
    // Not shown to the person (the file still uploads), but findable when a thumbnail is missing.
    console.warn('[media] could not make a thumbnail for the PDF', error);
    return null;
  }
}

/**
 * Makes and saves the first-page thumbnail for a PDF already in the library: for files uploaded
 * before thumbnails existed. Reads the PDF back from the library, draws page 1 and sends it.
 */
export async function addPdfCover(item: { id: string; url: string; filename: string }) {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error('Could not load the PDF.');
  const file = new File([await response.blob()], item.filename, { type: 'application/pdf' });
  const cover = await pdfCover(file);
  if (!cover) throw new Error('This PDF could not be drawn, so it keeps the generic cover.');

  const form = new FormData();
  form.set('cover', cover);
  const saved = await fetch(`/api/media-cover/${item.id}`, { method: 'POST', body: form });
  if (!saved.ok) {
    const body = (await saved.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Could not save the thumbnail.');
  }
}
