import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import {
  BulkPane,
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import {
  MessageSquareQuoteIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
} from '@/components/icons';
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
import { ImageField } from '@/components/media/image-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { readStatus, readYesNo } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type Testimonial,
  type TestimonialsData,
  deleteTestimonial,
  deleteTestimonials,
  importTestimonials,
  saveTestimonial,
} from '@/server/testimonials';

type Search = { selected?: string };

function attribution(t: Testimonial): string {
  return [t.relationship, t.location].filter(Boolean).join(' · ');
}

const NOUN: [string, string] = ['testimonial', 'testimonials'];

/** A CSV row's values as testimonial fields, or what is wrong with them. */
function testimonialFromCsv(values: Record<string, string>) {
  const status = readStatus(values.status ?? '');
  const featured = readYesNo(values.featured ?? '');
  if (!values.quote) return 'The quote is empty.';
  if (values.quote.length > 1000) return 'The quote is over 1000 characters.';
  if (!values.name) return 'The name is empty.';
  if (values.name.length > 80) return 'The name is over 80 characters.';
  if ((values.relationship ?? '').length > 80) return 'The relationship is over 80 characters.';
  if ((values.location ?? '').length > 80) return 'The location is over 80 characters.';
  if (featured === null) return 'Featured must be yes or no.';
  if (!status) return 'The status must be draft or published.';
  return {
    quote: values.quote,
    name: values.name,
    relationship: values.relationship,
    location: values.location,
    featured,
    status,
  };
}

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function TestimonialsPage({
  data,
  search,
  canWrite,
}: {
  data: TestimonialsData;
  search: Search;
  canWrite: boolean;
}) {
  const navigate = useNavigate({ from: '/testimonials/' });
  const { run, pending } = useAction();
  // Desktop: what the right-hand pane is editing, in place of the preview. Mobile
  // has no pane, so the same form opens in a dialog instead (as on the team page).
  const [editingId, setEditingId] = useState<string | 'new' | 'bulk' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Testimonial | 'new' | 'bulk' | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.map((t) => t.id));
  const visible = data.filter((t) =>
    matchesSearch(query, [t.name, t.quote, t.relationship, t.location])
  );

  const selectedId = data.find((t) => t.id === search.selected)?.id ?? data[0]?.id ?? null;
  const selected = data.find((t) => t.id === selectedId) ?? null;
  const select = (id: string) => {
    setEditingId(null);
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
  };

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openBulk = () => (isDesktop() ? setEditingId('bulk') : setDialogTarget('bulk'));
  const openEdit = (t: Testimonial) => (isDesktop() ? setEditingId(t.id) : setDialogTarget(t));
  const remove = (id: string) =>
    run(() => deleteTestimonial({ data: { id } }), 'Testimonial removed.');

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteTestimonials({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  const bulkForm = (onDone: () => void, footer: (submit: React.ReactNode) => React.ReactNode) => (
    <BulkCsvForm
      noun={NOUN}
      fileName="testimonials"
      fields={['quote', 'name', 'relationship', 'location', 'featured', 'status']}
      example={{
        quote: 'It felt like we were giving something back.',
        name: 'Jane Smith',
        relationship: 'Daughter',
        location: 'Melbourne',
        featured: 'no',
        status: 'draft',
      }}
      current={data.map((t) => ({
        id: t.id,
        quote: t.quote,
        name: t.name,
        relationship: t.relationship ?? '',
        location: t.location ?? '',
        featured: t.featured ? 'yes' : 'no',
        status: t.status,
      }))}
      toRow={testimonialFromCsv}
      apply={(rows) => importTestimonials({ data: { rows } })}
      onDone={onDone}
      footer={footer}
    />
  );

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Testimonials</h1>
        {data.length > 0 && (
          <SearchInput
            label="Search testimonials"
            placeholder="Search names and quotes"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && (
          <>
            <Button size="sm" variant="outline" onClick={openBulk}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Bulk update
            </Button>
            <Button size="sm" onClick={openNew}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add testimonial
            </Button>
          </>
        )}
      </div>

      {data.length === 0 && editingId === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareQuoteIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No testimonials yet</EmptyTitle>
            <EmptyDescription>Add a family quote and it appears here.</EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openBulk}>
                  <UploadIcon aria-hidden data-icon="inline-start" />
                  Bulk update
                </Button>
                <Button size="sm" onClick={openNew}>
                  <PlusIcon aria-hidden data-icon="inline-start" />
                  Add testimonial
                </Button>
              </div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_1fr]">
          <section aria-label="Testimonials" className="flex min-h-0 flex-col lg:border-r">
            {canWrite ? (
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((t) => t.id)}
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
                No testimonials match that search.
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((t) => (
                  <TestimonialListItem
                    key={t.id}
                    testimonial={t}
                    selected={editingId === null ? t.id === selectedId : t.id === editingId}
                    canWrite={canWrite}
                    checked={selection.isChecked(t.id)}
                    selecting={selection.checkedIds.length > 0}
                    onToggle={() => selection.toggle(t.id)}
                    onSelect={() => select(t.id)}
                    onOpen={() => (canWrite ? openEdit(t) : select(t.id))}
                  />
                ))}
              </ul>
            )}
          </section>

          {canWrite && editingId === 'bulk' ? (
            <section aria-label="Bulk update" className="hidden min-h-0 flex-col lg:flex">
              <BulkPane title="Bulk update testimonials">
                {bulkForm(
                  () => setEditingId(null),
                  (submit) => (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      {submit}
                    </div>
                  )
                )}
              </BulkPane>
            </section>
          ) : canWrite && editingId !== null ? (
            <section aria-label="Edit testimonial" className="hidden min-h-0 flex-col lg:flex">
              <TestimonialPane
                key={editingId}
                testimonial={data.find((t) => t.id === editingId) ?? null}
                onSaved={select}
                onClose={() => setEditingId(null)}
              />
            </section>
          ) : (
            <PreviewPane
              testimonial={selected}
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
        description="Their quotes are removed from the website. This cannot be undone."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(open) => !open && setDialogTarget(null)}
        >
          <DialogContent className={dialogTarget === 'bulk' ? 'sm:max-w-lg' : 'sm:max-w-md'}>
            <DialogHeader>
              <DialogTitle>
                {dialogTarget === 'bulk'
                  ? 'Bulk update testimonials'
                  : dialogTarget === 'new'
                    ? 'Add testimonial'
                    : 'Edit testimonial'}
              </DialogTitle>
              <DialogDescription>
                {dialogTarget === 'bulk'
                  ? 'Add or update many testimonials at once from a CSV file.'
                  : 'A quote from a family, shown on the website.'}
              </DialogDescription>
            </DialogHeader>
            {dialogTarget === 'bulk' ? (
              bulkForm(
                () => setDialogTarget(null),
                (submit) => (
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    {submit}
                  </DialogFooter>
                )
              )
            ) : (
              <TestimonialForm
                key={dialogTarget === 'new' ? 'new' : dialogTarget?.id}
                testimonial={dialogTarget === 'new' ? null : dialogTarget}
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
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TestimonialListItem({
  testimonial,
  selected,
  canWrite,
  checked,
  selecting,
  onToggle,
  onSelect,
  onOpen,
}: {
  testimonial: Testimonial;
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
          label={`Select the quote from ${testimonial.name}`}
          checked={checked}
          selecting={selecting}
          onToggle={onToggle}
          className="mt-2.5"
        />
      )}
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) onSelect();
          else onOpen();
        }}
        onDoubleClick={onOpen}
        className="focus-visible:ring-ring min-w-0 flex-1 rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-1"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {testimonial.name}
          </span>
          {testimonial.featured && (
            <StarIcon aria-label="Featured" className="size-3 shrink-0 fill-current" />
          )}
          {testimonial.status === 'draft' && (
            <span className="text-muted-foreground shrink-0 text-xs">Draft</span>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
          {testimonial.quote}
        </span>
      </button>
    </li>
  );
}

function PreviewPane({
  testimonial,
  canWrite,
  pending,
  onEdit,
  onDelete,
}: {
  testimonial: Testimonial | null;
  canWrite: boolean;
  pending: boolean;
  onEdit: (t: Testimonial) => void;
  onDelete: (id: string) => void;
}) {
  if (!testimonial) {
    return (
      <section aria-label="Preview" className="hidden lg:flex">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PanelRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No testimonial selected</EmptyTitle>
            <EmptyDescription>Choose one from the list to see it here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const from = attribution(testimonial);

  return (
    <section aria-label="Preview" className="hidden min-h-0 flex-col lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <Badge
          variant={testimonial.status === 'published' ? 'secondary' : 'outline'}
          className="capitalize"
        >
          {testimonial.status}
        </Badge>
        {testimonial.featured && <Badge variant="default">Featured</Badge>}
        <div className="ml-auto flex items-center gap-1.5">
          {canWrite && (
            <>
              <Button size="sm" onClick={() => onEdit(testimonial)}>
                <PencilIcon aria-hidden data-icon="inline-start" />
                Edit
              </Button>
              <DeleteTestimonial
                testimonial={testimonial}
                disabled={pending}
                onConfirm={() => onDelete(testimonial.id)}
              />
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <figure className="mx-auto max-w-xl px-8 py-12">
          <blockquote className="text-xl leading-relaxed font-medium text-balance">
            “{testimonial.quote}”
          </blockquote>
          <figcaption className="mt-6">
            <div className="font-medium">{testimonial.name}</div>
            {from && <div className="text-muted-foreground text-sm">{from}</div>}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function DeleteTestimonial({
  testimonial,
  disabled,
  onConfirm,
}: {
  testimonial: Testimonial;
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
            aria-label={`Remove testimonial from ${testimonial.name}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this testimonial?</AlertDialogTitle>
          <AlertDialogDescription>
            The quote from {testimonial.name} is removed from the website. This cannot be undone.
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
        'Add testimonial'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header, scrollable form body, cancel back to the preview. */
function TestimonialPane({
  testimonial,
  onSaved,
  onClose,
}: {
  testimonial: Testimonial | null;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="text-sm font-medium">
          {testimonial ? `Edit ${testimonial.name}` : 'New testimonial'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          <TestimonialForm
            testimonial={testimonial}
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

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function TestimonialForm({
  testimonial,
  onSaved,
  footer,
}: {
  testimonial: Testimonial | null;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
}) {
  const [quote, setQuote] = useState(testimonial?.quote ?? '');
  const [name, setName] = useState(testimonial?.name ?? '');
  const [relationship, setRelationship] = useState(testimonial?.relationship ?? '');
  const [location, setLocation] = useState(testimonial?.location ?? '');
  const [featured, setFeatured] = useState(testimonial?.featured ?? false);
  const [published, setPublished] = useState(testimonial?.status === 'published');
  const [photoMediaId, setPhotoMediaId] = useState(testimonial?.photoMediaId ?? null);
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveTestimonial({
          data: {
            id: testimonial?.id,
            quote,
            name,
            relationship: relationship || undefined,
            location: location || undefined,
            featured,
            status: published ? 'published' : 'draft',
            photoMediaId,
          },
        }),
      testimonial ? 'Testimonial updated.' : 'Testimonial added.'
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="t-quote">Quote</Label>
        <Textarea
          id="t-quote"
          required
          rows={4}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="What they said, in their own words…"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="t-name">Name</Label>
          <Input
            id="t-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-relationship">Relationship</Label>
          <Input
            id="t-relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Customer"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-location">Location</Label>
        <Input
          id="t-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Melbourne"
        />
      </div>
      <ImageField
        id="t-photo"
        label="Photo"
        description="Optional. A photo of the person, with their permission."
        shape="square"
        mediaId={photoMediaId}
        onChange={setPhotoMediaId}
      />
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Featured</div>
          <div className="text-muted-foreground text-xs">Highlight this quote on the site.</div>
        </div>
        <Switch checked={featured} onCheckedChange={setFeatured} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Published</div>
          <div className="text-muted-foreground text-xs">Show this quote on the website.</div>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </div>
      {footer(pending, testimonial === null)}
    </form>
  );
}
