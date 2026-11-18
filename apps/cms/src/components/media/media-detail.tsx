// One file in the Media library, on its own page: a large preview with crop, replace and (for
// images) a focal point beside its details, tags and alt text, then where it is used and the
// versions it used to be. Replaces the side panel, so a file has an address and room to be
// looked at.
import { DOCUMENT_ACCEPT, isDocumentMime } from '@ll/content';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  CropIcon,
  DownloadIcon,
  SaveIcon,
  Trash2Icon,
} from '@/components/icons';
import { TagInput } from '@/components/faqs/tag-input';
import { ConfirmBulkDelete } from '@/components/list/list-tools';
import { DocumentThumb } from '@/components/media/document-card';
import { FocalPicker, type Focal } from '@/components/media/focal-point';
import { ImageCropDialog } from '@/components/media/image-crop-dialog';
import { download, extensionLabel, fileFacts } from '@/components/media/media-file';
import { MediaUsageList } from '@/components/media/media-usage';
import { MediaVersions } from '@/components/media/media-versions';
import { PdfPages } from '@/components/media/pdf-pages';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { splitFilename } from '@/lib/filename';
import { formatBytes, formatDateTime } from '@/lib/format';
import { recallMediaSearch } from '@/lib/media-return';
import { notify, removedNotice } from '@/lib/notify';
import { canCrop } from '@/lib/prepare-image';
import { IMAGE_ACCEPT, mediaSrc, uploadMedia } from '@/lib/upload-media';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { type MediaDetail as Detail, deleteMedia, updateMedia } from '@/server/media';

const NOUN: [string, string] = ['file', 'files'];

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sameFocal = (a: Focal | null, b: Focal | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y);
const sameTags = (a: string[], b: string[]) =>
  a.length === b.length && a.every((t, i) => t === b[i]);

export function MediaDetail({
  detail,
  tagSuggestions,
  canDelete,
}: {
  detail: Detail;
  tagSuggestions: string[];
  canDelete: boolean;
}) {
  const { item, uploader, previousId, nextId, versions } = detail;
  const navigate = useNavigate();
  const zone = useTimeZone();
  const isDocument = isDocumentMime(item.mime);
  const isPdf = item.mime === 'application/pdf';
  const { base: originalName, ext } = splitFilename(item.filename);
  const [name, setName] = useState(originalName);
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [tags, setTags] = useState(item.tags);
  const [focal, setFocal] = useState<Focal | null>(item.focal);
  const [reading, setReading] = useState(false);
  // The file being cropped, fetched back from the library.
  const [cropping, setCropping] = useState<File | null>(null);
  const [loadingCrop, setLoadingCrop] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The file picked to go behind this one, waiting for a yes.
  const [replacement, setReplacement] = useState<File | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();

  const renamed = name.trim() !== originalName;
  const dirty =
    renamed ||
    alt !== item.alt ||
    caption !== item.caption ||
    !sameTags(tags, item.tags) ||
    !sameFocal(focal, item.focal);

  // ← and → move through the library, unless the keys are being used to type or move a point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"], button')) {
        return;
      }
      const id = e.key === 'ArrowLeft' ? previousId : e.key === 'ArrowRight' ? nextId : null;
      if (id) void navigate({ to: '/media/$mediaId', params: { mediaId: id } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previousId, nextId, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () =>
        updateMedia({
          data: {
            id: item.id,
            alt,
            caption,
            tags,
            ...(!sameFocal(focal, item.focal) && { focal }),
            ...(renamed && { filename: name }),
          },
        }),
      {
        success: {
          title: 'Details saved',
          description: renamed
            ? 'The new name shows in the media library. Anything using the file is unchanged.'
            : 'The details are updated in the media library.',
        },
        error: 'Could not save the details',
      }
    );
  }

  async function startCrop() {
    setLoadingCrop(true);
    try {
      const res = await fetch(`${item.url}?v=${item.version}`);
      if (!res.ok) throw new Error('Could not load this image.');
      const blob = await res.blob();
      setCropping(new File([blob], item.filename, { type: blob.type || item.mime }));
    } catch (error) {
      notify.error('Could not open the cropper', error);
    } finally {
      setLoadingCrop(false);
    }
  }

  // A crop is saved as a new file, so anything already using this one keeps
  // it as it is. The copy takes over the alt text, caption and tags, and opens.
  async function saveCopy(file: File) {
    const copy = await uploadMedia(file);
    if (item.alt || item.caption || item.tags.length) {
      await updateMedia({
        data: { id: copy.id, alt: item.alt, caption: item.caption, tags: item.tags },
      });
    }
    setCropping(null);
    notify.success({
      title: 'Cropped copy saved',
      description: 'The original is unchanged, so anything using it stays as it is.',
    });
    await navigate({ to: '/media/$mediaId', params: { mediaId: copy.id } });
  }

  // Same id and URL, so everything using this file shows the new one. The old file is kept
  // under Earlier versions.
  async function replaceFile() {
    if (!replacement) return;
    const result = await run(() => uploadMedia(replacement, item.id), {
      success: {
        title: 'File replaced',
        description:
          'Everything using this file shows the new one. The old file is kept under Earlier versions.',
      },
      error: 'Could not replace the file',
    });
    if (result !== undefined) setReplacement(null);
  }

  async function remove() {
    await run(() => deleteMedia({ data: { ids: [item.id] } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the file',
      // Leaves before the data refreshes, so the page never flashes "gone".
      afterAction: () => navigate({ to: '/media' }),
    });
  }

  const address = new URL(
    item.url,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  ).href;
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success({ title: `${what} copied`, description: 'Ready to paste.' });
    } catch {
      notify.error('Could not copy', 'Select the text and copy it instead.');
    }
  };
  const snippets = [
    { label: 'Link', text: address },
    isDocument
      ? { label: 'Markdown link', text: `[${item.filename}](${address})` }
      : { label: 'Markdown image', text: `![${alt}](${address})` },
    isDocument
      ? {
          label: 'HTML link',
          text: `<a href="${escapeHtml(address)}">${escapeHtml(item.filename)}</a>`,
        }
      : {
          label: 'HTML image',
          text: `<img src="${escapeHtml(address)}" alt="${escapeHtml(alt)}"${
            item.width && item.height ? ` width="${item.width}" height="${item.height}"` : ''
          } loading="lazy" />`,
        },
  ];

  const back = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      // Phones have ‹ Media in the app's own top bar.
      className="max-md:hidden"
      // Always the library, with its search and filters as they were left. Not the page before:
      // after Previous and Next that would be another file.
      render={<Link to="/media" search={recallMediaSearch()} />}
      nativeButton={false}
    >
      <ChevronLeftIcon aria-hidden data-icon="inline-start" />
      Media
    </Button>
  );

  const neighbour = (id: string | null, label: string, children: React.ReactNode) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={`${label} (${label === 'Previous file' ? '←' : '→'})`}
      disabled={!id}
      {...(id
        ? { render: <Link to="/media/$mediaId" params={{ mediaId: id }} />, nativeButton: false }
        : {})}
    >
      {children}
    </Button>
  );

  const preview = isDocument ? (
    <div className="grid gap-3">
      <DocumentThumb
        item={item}
        width={640}
        showName={false}
        className="h-80 w-full rounded-lg border"
      />
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ui text-primary w-fit underline underline-offset-4"
        >
          {isPdf ? 'Open the PDF' : 'Download the file'}
        </a>
        {isPdf && (
          <Button type="button" variant="outline" size="sm" onClick={() => setReading((r) => !r)}>
            {reading ? 'Hide the pages' : 'Read the pages here'}
          </Button>
        )}
      </div>
      {isPdf && reading && <PdfPages url={item.url} />}
    </div>
  ) : (
    <FocalPicker
      // The current file's copy, so a replace shows the new picture straight away.
      src={mediaSrc(item, 1280)}
      alt={item.alt || item.filename}
      value={focal}
      onChange={setFocal}
    />
  );

  const facts: [string, string][] = [
    ['Type', `${extensionLabel(item)} · ${item.mime}`],
    ...(item.width && item.height
      ? ([['Dimensions', `${item.width} × ${item.height} px`]] as [string, string][])
      : []),
    ['Size', formatBytes(item.size)],
    ['Uploaded', `${formatDateTime(item.createdAt, zone)}${uploader ? ` by ${uploader}` : ''}`],
    ...(item.version - item.createdAt > 60_000
      ? ([['File changed', formatDateTime(item.version, zone)]] as [string, string][])
      : []),
  ];

  return (
    <>
      <form onSubmit={save} data-slot="media-detail" className="flex min-h-0 flex-1 flex-col">
        <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b px-3 py-1.5">
          {back}
          <div className="flex items-center">
            {neighbour(previousId, 'Previous file', <ChevronLeftIcon aria-hidden />)}
            {neighbour(nextId, 'Next file', <ChevronRightIcon aria-hidden />)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">{item.filename}</h1>
            <p className="text-muted-foreground text-xs">
              {fileFacts(item)}
              {dirty && <span aria-live="polite"> · Unsaved changes</span>}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="sm" />}
              aria-label="Copy"
            >
              <CopyIcon aria-hidden data-icon="inline-start" />
              <span className="max-sm:sr-only">Copy</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 p-1">
              {snippets.map((s) => (
                <DropdownMenuItem
                  key={s.label}
                  className="text-ui rounded-md py-1"
                  onClick={() => void copy(s.label, s.text)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="ghost" size="sm" onClick={() => download(item)}>
            <DownloadIcon aria-hidden data-icon="inline-start" />
            <span className="max-sm:sr-only">Download</span>
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2Icon aria-hidden data-icon="inline-start" />
              <span className="max-sm:sr-only">Delete</span>
            </Button>
          )}
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SaveIcon aria-hidden data-icon="inline-start" />
            )}
            Save
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 content-start gap-8 overflow-y-auto p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:p-6">
          <div className="grid content-start gap-5">
            {preview}
            {!isDocument && (
              <p className="text-muted-foreground -mt-2 text-xs">
                Click the picture to choose the part that stays in view when it is cropped.
              </p>
            )}
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isDocument && canCrop({ type: item.mime }) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingCrop || pending}
                    onClick={startCrop}
                  >
                    {loadingCrop ? <Spinner /> : <CropIcon aria-hidden data-icon="inline-start" />}
                    Crop a copy
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => replaceInput.current?.click()}
                >
                  <ArrowRightLeft aria-hidden data-icon="inline-start" />
                  Replace file
                </Button>
                <input
                  ref={replaceInput}
                  type="file"
                  accept={isDocument ? DOCUMENT_ACCEPT : IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    setReplacement(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </div>
              {replacement ? (
                <div className="bg-muted/50 grid gap-3 rounded-md border p-3">
                  <p className="text-ui">
                    Replace with <span className="font-medium break-all">{replacement.name}</span>?
                    Everything using this {isDocument ? 'document' : 'image'} shows the new file.
                    The {isDocument ? 'caption stays' : 'alt text and caption stay'}, and the old
                    file is kept under Earlier versions.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={pending} onClick={replaceFile}>
                      {pending ? <Spinner /> : null}
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setReplacement(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {isDocument
                    ? "Replacing keeps this document's address, so links to it keep working."
                    : "A crop is saved as a new file. Replacing keeps this image's address."}
                </p>
              )}
            </div>
            <MediaVersions mediaId={item.id} versions={versions} />
          </div>

          <div className="grid content-start gap-6">
            <div className="grid gap-3">
              <Label htmlFor="m-name">Name</Label>
              <InputGroup>
                <InputGroupInput
                  id="m-name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-describedby={ext ? 'm-name-ext' : undefined}
                />
                {ext && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupText id="m-name-ext">{ext}</InputGroupText>
                  </InputGroupAddon>
                )}
              </InputGroup>
              <p className="text-muted-foreground -mt-1 text-xs">
                Only the name in the library changes. Anything using this file keeps working.
              </p>
            </div>
            {!isDocument && (
              <div className="grid gap-3">
                <Label htmlFor="m-alt">Alt text</Label>
                <Input
                  id="m-alt"
                  maxLength={300}
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Describes the image for screen readers and SEO"
                />
                {alt.trim() === '' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No alt text yet. Screen readers and search engines skip an image without it.
                  </p>
                )}
              </div>
            )}
            <div className="grid gap-3">
              <Label htmlFor="m-caption">Caption</Label>
              <Textarea
                id="m-caption"
                rows={3}
                maxLength={500}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="m-tags">Tags</Label>
              <TagInput
                id="m-tags"
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder="Add a tag, like spring or brochure"
              />
              <p className="text-muted-foreground -mt-1 text-xs">
                For finding files in the library. Press Enter or a comma to add one.
              </p>
            </div>
            <section className="grid gap-2" aria-labelledby="m-facts">
              <h3 id="m-facts" className="text-sm font-medium">
                Details
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <MediaUsageList id={item.id} />
          </div>
        </div>
      </form>

      <ConfirmBulkDelete
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        count={1}
        noun={NOUN}
        description="It is removed for good, with its earlier versions. Anything using it, like a post or a team member, loses that file."
        onConfirm={remove}
      />
      <ImageCropDialog file={cropping} onCancel={() => setCropping(null)} onDone={saveCopy} />
    </>
  );
}
