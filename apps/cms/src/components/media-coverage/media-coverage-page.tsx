import { type MediaCoverageKind, mediaCoverageKindLabels, slugify, youtubeId } from '@llf/content';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import { DateTimePicker } from '@/components/date-time-picker';
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLink,
  NewspaperIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from '@/components/icons';
import { ImageField, useMediaItem } from '@/components/media/image-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  type MediaCoverageData,
  type MediaCoverageItem,
  deleteMediaCoverage,
  saveMediaCoverage,
} from '@/server/media-coverage';

type Search = { selected?: string };

const NOUN: [string, string] = ['item', 'items'];

const kindItems = (Object.keys(mediaCoverageKindLabels) as MediaCoverageKind[]).map((value) => ({
  value,
  label: mediaCoverageKindLabels[value],
}));

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function MediaCoveragePage({
  data,
  search,
  canWrite,
}: {
  data: MediaCoverageData;
  search: Search;
  canWrite: boolean;
}) {
  const navigate = useNavigate({ from: '/media-coverage/' });
  const { run, pending } = useAction();
  // Desktop edits in the right-hand pane; mobile has no pane, so the same form
  // opens in a dialog instead (as on the testimonials page).
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<MediaCoverageItem | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.map((m) => m.id));
  const visible = data.filter((m) =>
    matchesSearch(query, [m.title, m.source, m.category, m.excerpt])
  );
  // Offered as suggestions, so the page's topic filter stays tidy.
  const categories = [...new Set(data.map((m) => m.category).filter(Boolean))] as string[];

  const selectedId = data.find((m) => m.id === search.selected)?.id ?? data[0]?.id ?? null;
  const selected = data.find((m) => m.id === selectedId) ?? null;
  const select = (id: string) => {
    setEditingId(null);
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
  };

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openEdit = (m: MediaCoverageItem) =>
    isDesktop() ? setEditingId(m.id) : setDialogTarget(m);
  const remove = (id: string) =>
    run(() => deleteMediaCoverage({ data: { ids: [id] } }), 'Item removed.');

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteMediaCoverage({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  // Shown after the last item, so a new one lands at the end by default.
  const nextOrder = Math.max(0, ...data.map((m) => m.sortOrder)) + 1;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Media coverage</h1>
        {data.length > 0 && (
          <SearchInput
            label="Search media coverage"
            placeholder="Search titles and outlets"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add coverage
          </Button>
        )}
      </div>

      {data.length === 0 && editingId === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NewspaperIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No media coverage yet</EmptyTitle>
            <EmptyDescription>
              Add a news article or video and it appears on the In the media page.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <Button size="sm" onClick={openNew}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                Add coverage
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_1fr]">
          <section aria-label="Media coverage" className="flex min-h-0 flex-col lg:border-r">
            {canWrite ? (
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((m) => m.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={() => setConfirmDelete(true)}
              />
            ) : (
              <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-[13px] font-medium">All</span>
                <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
              </div>
            )}
            {visible.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                Nothing matches that search.
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((m) => (
                  <CoverageListItem
                    key={m.id}
                    item={m}
                    selected={editingId === null ? m.id === selectedId : m.id === editingId}
                    canWrite={canWrite}
                    checked={selection.isChecked(m.id)}
                    selecting={selection.checkedIds.length > 0}
                    onToggle={() => selection.toggle(m.id)}
                    onSelect={() => select(m.id)}
                    onOpen={() => (canWrite ? openEdit(m) : select(m.id))}
                  />
                ))}
              </ul>
            )}
          </section>

          {canWrite && editingId !== null ? (
            <section aria-label="Edit coverage" className="hidden min-h-0 flex-col lg:flex">
              <CoveragePane
                key={editingId}
                item={data.find((m) => m.id === editingId) ?? null}
                categories={categories}
                nextOrder={nextOrder}
                onSaved={select}
                onClose={() => setEditingId(null)}
              />
            </section>
          ) : (
            <PreviewPane
              item={selected}
              canWrite={canWrite}
              pending={pending}
              onEdit={openEdit}
              onDelete={remove}
            />
          )}
        </div>
      )}

      <ConfirmBulkDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selection.checkedIds.length}
        noun={NOUN}
        description="They are removed from the In the media page. This cannot be undone."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(open) => !open && setDialogTarget(null)}
        >
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{dialogTarget === 'new' ? 'Add coverage' : 'Edit coverage'}</DialogTitle>
              <DialogDescription>A news article or video, shown on In the media.</DialogDescription>
            </DialogHeader>
            <CoverageForm
              key={dialogTarget === 'new' ? 'new' : dialogTarget?.id}
              item={dialogTarget === 'new' ? null : dialogTarget}
              categories={categories}
              nextOrder={nextOrder}
              onSaved={() => setDialogTarget(null)}
              footer={(formPending, isNew) => (
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <SubmitButton pending={formPending} isNew={isNew} />
                </DialogFooter>
              )}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CoverageListItem({
  item,
  selected,
  canWrite,
  checked,
  selecting,
  onToggle,
  onSelect,
  onOpen,
}: {
  item: MediaCoverageItem;
  selected: boolean;
  canWrite: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      className={cn(
        'group flex items-start gap-1 rounded-md transition-colors',
        canWrite && 'pl-1.5',
        selected ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      {canWrite && (
        <RowCheckbox
          label={`Select ${item.title}`}
          checked={checked}
          selecting={selecting}
          onToggle={onToggle}
          className="mt-2.5"
        />
      )}
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => (isDesktop() ? onSelect() : onOpen())}
        onDoubleClick={onOpen}
        className="focus-visible:ring-ring min-w-0 flex-1 rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-1"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</span>
          {item.featured && (
            <StarIcon aria-label="Featured" className="size-3 shrink-0 fill-current" />
          )}
          {item.status === 'draft' && (
            <span className="text-muted-foreground shrink-0 text-xs">Draft</span>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
          {item.source} · {mediaCoverageKindLabels[item.kind]}
          {item.category && ` · ${item.category}`}
        </span>
      </button>
    </li>
  );
}

function PreviewPane({
  item,
  canWrite,
  pending,
  onEdit,
  onDelete,
}: {
  item: MediaCoverageItem | null;
  canWrite: boolean;
  pending: boolean;
  onEdit: (m: MediaCoverageItem) => void;
  onDelete: (id: string) => void;
}) {
  if (!item) {
    return (
      <section aria-label="Preview" className="hidden lg:flex">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PanelRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nothing selected</EmptyTitle>
            <EmptyDescription>Choose an item from the list to see it here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section aria-label="Preview" className="hidden min-h-0 flex-col lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <Badge
          variant={item.status === 'published' ? 'secondary' : 'outline'}
          className="capitalize"
        >
          {item.status}
        </Badge>
        {item.featured && <Badge variant="default">Featured</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            render={<a href={item.externalUrl} target="_blank" rel="noopener noreferrer" />}
            aria-label="Open the original"
            nativeButton={false}
          >
            <ExternalLink aria-hidden className="size-4" />
          </Button>
          {canWrite && (
            <>
              <Button size="sm" onClick={() => onEdit(item)}>
                <PencilIcon aria-hidden data-icon="inline-start" />
                Edit
              </Button>
              <DeleteCoverage item={item} disabled={pending} onConfirm={() => onDelete(item.id)} />
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-sm px-6 py-10">
          <CoverageCard item={item} />
        </div>
      </div>
    </section>
  );
}

/** Roughly how the card reads on the website. */
function CoverageCard({ item }: { item: MediaCoverageItem }) {
  const zone = useTimeZone();
  const { item: image } = useMediaItem(item.imageMediaId);
  const videoId = item.kind === 'video' ? youtubeId(item.externalUrl) : null;
  const thumb = image?.url ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
  const meta = [
    item.coverageDate !== null && formatDate(item.coverageDate, zone),
    item.readingMinutes !== null && `${item.readingMinutes} min read`,
  ].filter(Boolean);

  return (
    <article>
      <div className="bg-muted relative aspect-video overflow-hidden rounded-xl border">
        {thumb ? (
          <img src={thumb} alt={image?.alt ?? ''} className="size-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs">
            {item.kind === 'article' ? 'No image yet' : 'Not a YouTube link, so no thumbnail'}
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
        {item.source} · {item.kind === 'video' ? 'Video' : 'News'}
      </p>
      <h2 className="mt-1.5 text-lg leading-snug font-medium text-balance">{item.title}</h2>
      {item.excerpt && <p className="text-muted-foreground mt-2 text-sm">{item.excerpt}</p>}
      {meta.length > 0 && <p className="text-muted-foreground mt-3 text-xs">{meta.join(' · ')}</p>}
      {item.category && (
        <Badge variant="outline" className="mt-4">
          {item.category}
        </Badge>
      )}
    </article>
  );
}

function DeleteCoverage({
  item,
  disabled,
  onConfirm,
}: {
  item: MediaCoverageItem;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${item.title}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this item?</AlertDialogTitle>
          <AlertDialogDescription>
            “{item.title}” is removed from the In the media page. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SubmitButton({ pending, isNew }: { pending: boolean; isNew: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : isNew ? (
        'Add coverage'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header, scrollable form body, cancel back to the preview. */
function CoveragePane({
  item,
  categories,
  nextOrder,
  onSaved,
  onClose,
}: {
  item: MediaCoverageItem | null;
  categories: string[];
  nextOrder: number;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="truncate text-sm font-medium">
          {item ? `Edit ${item.title}` : 'New coverage'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          <CoverageForm
            item={item}
            categories={categories}
            nextOrder={nextOrder}
            onSaved={onSaved}
            footer={(pending, isNew) => (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <SubmitButton pending={pending} isNew={isNew} />
              </div>
            )}
          />
        </div>
      </div>
    </>
  );
}

/**
 * One category, picked from those already in use or typed new. Styled as a
 * select so it matches Kind beside it.
 */
function CategoryPicker({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().slice(0, 40);
  const exists = options.some((o) => o.toLowerCase() === query.toLowerCase());
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between pr-2 pl-2.5 font-normal',
              !value && 'text-muted-foreground'
            )}
          />
        }
      >
        <span className="truncate">{value || 'None'}</span>
        <ChevronDownIcon aria-hidden className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput
            placeholder="Find or create a category…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="text-muted-foreground p-4 text-center text-xs">
              No categories yet. Type one to create it.
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => pick(option)}>
                  <CheckIcon
                    aria-hidden
                    className={cn('size-3.5', option === value ? 'opacity-100' : 'opacity-0')}
                  />
                  {option}
                </CommandItem>
              ))}
              {query && !exists && (
                <CommandItem value={`create ${query}`} onSelect={() => pick(query)}>
                  <PlusIcon aria-hidden className="size-3.5" />
                  Create “{query}”
                </CommandItem>
              )}
              {value && (
                <CommandItem value="clear category" onSelect={() => pick('')}>
                  <XIcon aria-hidden className="size-3.5" />
                  No category
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function CoverageForm({
  item,
  categories,
  nextOrder,
  onSaved,
  footer,
}: {
  item: MediaCoverageItem | null;
  categories: string[];
  nextOrder: number;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  // A new item's slug follows its title until someone edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(item !== null);
  const [kind, setKind] = useState<MediaCoverageKind>(item?.kind ?? 'article');
  const [category, setCategory] = useState(item?.category ?? '');
  const [source, setSource] = useState(item?.source ?? '');
  const [coverageDate, setCoverageDate] = useState<number | null>(item?.coverageDate ?? null);
  const [excerpt, setExcerpt] = useState(item?.excerpt ?? '');
  const [readingMinutes, setReadingMinutes] = useState(
    item?.readingMinutes ? String(item.readingMinutes) : ''
  );
  const [imageMediaId, setImageMediaId] = useState(item?.imageMediaId ?? null);
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl ?? '');
  const [featured, setFeatured] = useState(item?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? nextOrder));
  const [published, setPublished] = useState(item ? item.status === 'published' : true);
  const { run, pending } = useAction();

  const notYouTube = kind === 'video' && externalUrl !== '' && youtubeId(externalUrl) === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveMediaCoverage({
          data: {
            id: item?.id,
            title,
            slug,
            kind,
            category,
            source,
            coverageDate,
            excerpt,
            readingMinutes: readingMinutes ? Number(readingMinutes) : null,
            imageMediaId,
            externalUrl,
            featured,
            sortOrder: Number(sortOrder) || 0,
            status: published ? 'published' : 'draft',
          },
        }),
      item ? 'Coverage updated.' : 'Coverage added.'
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mc-title">Title</Label>
        <Input
          id="mc-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="As the outlet headlined it"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-slug">Slug</Label>
        <Input
          id="mc-slug"
          maxLength={80}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          onBlur={() => setSlug(slugify(slug || title))}
          placeholder="made-from-the-title"
          className="font-mono text-[13px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mc-kind">Kind</Label>
          <Select
            items={kindItems}
            value={kind}
            onValueChange={(v) => v && setKind(v as MediaCoverageKind)}
          >
            <SelectTrigger id="mc-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindItems.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mc-category">Category</Label>
          <CategoryPicker
            id="mc-category"
            value={category}
            options={categories}
            onChange={setCategory}
          />
        </div>
      </div>
      <Hint>The category drives the topic filter on the page, e.g. Science or Broadcast.</Hint>
      <div className="space-y-1.5">
        <Label htmlFor="mc-source">Source</Label>
        <Input
          id="mc-source"
          required
          maxLength={80}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Herald Sun"
        />
        <Hint>The outlet name, e.g. The Senior, Herald Sun, Today Tonight.</Hint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-date">Published at</Label>
        <DateTimePicker
          id="mc-date"
          value={coverageDate}
          onChange={setCoverageDate}
          placeholder="When the outlet ran it"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-excerpt">Excerpt</Label>
        <Textarea
          id="mc-excerpt"
          rows={3}
          maxLength={400}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
        <Hint>A short summary shown beneath the title on the card.</Hint>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-reading">Reading time (min)</Label>
        <Input
          id="mc-reading"
          type="number"
          inputMode="numeric"
          min={1}
          max={240}
          value={readingMinutes}
          onChange={(e) => setReadingMinutes(e.target.value)}
          className="w-28"
        />
        <Hint>Optional. Shown as the read time on the card.</Hint>
      </div>
      <ImageField
        id="mc-image"
        label="Image"
        description="Used for news articles and as the thumbnail for video cards."
        mediaId={imageMediaId}
        onChange={setImageMediaId}
      />
      <div className="space-y-1.5">
        <Label htmlFor="mc-url">External URL</Label>
        <Input
          id="mc-url"
          type="url"
          required
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://"
        />
        <Hint>
          {notYouTube
            ? 'Not a YouTube link, so the card opens it in a new tab instead of playing it.'
            : 'A link to the original article or video.'}
        </Hint>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Featured</div>
          <div className="text-muted-foreground text-xs">Shown first, as a larger card.</div>
        </div>
        <Switch checked={featured} onCheckedChange={setFeatured} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mc-order">Order</Label>
        <Input
          id="mc-order"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-28"
        />
        <Hint>Lower numbers come first.</Hint>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Published</div>
          <div className="text-muted-foreground text-xs">Show this on the website.</div>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </div>
      {footer(pending, item === null)}
    </form>
  );
}
