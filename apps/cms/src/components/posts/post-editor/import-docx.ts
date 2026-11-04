import { type RichTextDoc, slugify } from '@ll/content';
import { uploadMedia } from '@/lib/upload-media';

/**
 * Converts a .docx file to a post body. The document's images go into Media;
 * any that fail to upload are left out and counted, so the editor can say so.
 */
export async function docxToBody(file: File): Promise<{ body: RichTextDoc; failedImages: number }> {
  const [{ default: mammoth }, { generateJSON }, { postContentExtensions }] = await Promise.all([
    import('mammoth'),
    import('@tiptap/core'),
    import('../post-extensions'),
  ]);
  let failedImages = 0;
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const ext = image.contentType.split('/')[1] ?? 'png';
        const upload = new File(
          [await image.readAsArrayBuffer()],
          `${slugify(file.name.replace(/\.docx$/i, '')) || 'image'}.${ext}`,
          { type: image.contentType }
        );
        try {
          return { src: (await uploadMedia(upload)).url };
        } catch {
          failedImages += 1;
          return { src: '' };
        }
      }),
    }
  );
  // Images that failed have an empty src; drop them rather than keep broken tags.
  const body = generateJSON(html.replace(/<img\b[^>]*\bsrc=""[^>]*>/g, ''), postContentExtensions);
  return { body: body as RichTextDoc, failedImages };
}
