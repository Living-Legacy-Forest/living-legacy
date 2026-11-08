import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  PaneActions,
  PaneColumn,
  PaneFrame,
  isDesktop,
  useListPane,
} from '@/components/list/list-page';
import { ListRow } from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
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
import { FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { ImageField } from '@/components/media/image-field';
import { PageActions } from '@/components/shell/page-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { readStatus, readYesNo } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
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

/** What the pane edits in place of the preview (or the dialog shows, on smaller screens). */
type Target = { kind: 'edit'; id: string } | { kind: 'new' } | { kind: 'bulk' };

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
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((t) => t.id));
  const visible = data.filter((t) =>
    matchesSearch(query, [t.name, t.quote, t.relationship, t.location])
  );

  const testimonialFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((t) => t.id === target.id) ?? null) : null;
  // Without anything being edited, the pane previews the selected testimonial.
  const selectedId = data.find((t) => t.id === search.selected)?.id ?? data[0]?.id ?? null;
  const selected = data.find((t) => t.id === selectedId) ?? null;
  const select = (id: string) => {
    view.closePane();
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });
  };
  const pane = canWrite ? view.pane : null;
  const remove = (id: string) =>
    run(() => deleteTestimonial({ data: { id } }), {
      success: removedNotice(1, NOUN),
      error: 'Could not remove the testimonial',
    });

  async function removeMany(ids: string[]) {
    const result = await run(() => deleteTestimonials({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  const bulkForm = (onDone: () => void, actions: (submit: React.ReactNode) => React.ReactNode) => (
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
      footer={actions}
    />
  );

  const testimonialForm = (
    target: Target,
    onSaved: (id: string) => void,
    actions: (submit: React.ReactNode) => React.ReactNode
  ) => (
    <TestimonialForm
      key={target.kind === 'edit' ? target.id : target.kind}
      testimonial={testimonialFor(target)}
      onSaved={onSaved}
      footer={(formPending, isNew) => actions(<SubmitButton pending={formPending} isNew={isNew} />)}
    />
  );

  const addButtons = (
    <>
      <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
        <UploadIcon aria-hidden data-icon="inline-start" />
        Bulk update
      </Button>
      <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
        <PlusIcon aria-hidden data-icon="inline-start" />
        Add testimonial
      </Button>
    </>
  );

  const paneTestimonial = testimonialFor(pane);
  const dialogTestimonial = testimonialFor(view.dialog);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Testimonials
        </h1>
        {data.length > 0 && (
          <SearchInput
            label="Search testimonials"
            placeholder="Search names and quotes"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && <div className="flex gap-3 max-md:hidden">{addButtons}</div>}
        {canWrite && (
          <PageActions
            edit={{
              editing: selection.selecting,
              onToggle: selection.selecting ? selection.clear : selection.startEditing,
            }}
            add={{ label: 'Add testimonial', onClick: () => view.open({ kind: 'new' }) }}
            more={[{ label: 'Bulk update', onClick: () => view.open({ kind: 'bulk' }) }]}
          />
        )}
      </div>

      {data.length === 0 && pane === null ? (
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
              <div className="flex gap-2">{addButtons}</div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ListPageLayout>
          <ListColumn
            label="Testimonials"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((t) => t.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => setToDelete(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches onClear={() => setQuery('')}>No testimonials match that search.</NoMatches>
            ) : (
              <ListRows>
                {visible.map((t) => (
                  <ListRow
                    key={t.id}
                    align="start"
                    current={
                      pane === null ? t.id === selectedId : pane.kind === 'edit' && pane.id === t.id
                    }
                    select={
                      canWrite
                        ? {
                            label: `Select the quote from ${t.name}`,
                            checked: selection.isChecked(t.id),
                            selecting: selection.selecting,
                            onToggle: () => selection.toggle(t.id),
                          }
                        : undefined
                    }
                    swipe={
                      canWrite
                        ? { label: 'Delete', onAction: () => setToDelete([t.id]) }
                        : undefined
                    }
                    // Large screens preview on a click and edit on a double click; smaller
                    // ones have no preview, so a tap edits.
                    onOpen={() =>
                      isDesktop() ? select(t.id) : canWrite && view.open({ kind: 'edit', id: t.id })
                    }
                    onDoubleClick={() => canWrite && view.open({ kind: 'edit', id: t.id })}
                  >
                    <TestimonialSummary testimonial={t} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          {pane?.kind === 'bulk' ? (
            <PaneColumn label="Bulk update">
              <PaneFrame title="Bulk update testimonials" width="lg">
                {bulkForm(view.closePane, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            </PaneColumn>
          ) : pane !== null ? (
            <PaneColumn label="Edit testimonial">
              <PaneFrame
                title={paneTestimonial ? `Edit ${paneTestimonial.name}` : 'New testimonial'}
              >
                {testimonialForm(pane, select, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            </PaneColumn>
          ) : (
            <PreviewPane
              testimonial={selected}
              canWrite={canWrite}
              pending={pending}
              onEdit={(t) => view.open({ kind: 'edit', id: t.id })}
              onDelete={remove}
            />
          )}
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="Their quotes are removed from the website. This cannot be undone."
        onConfirm={() => toDelete && removeMany(toDelete)}
      />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          size={view.dialog?.kind === 'bulk' ? 'lg' : 'md'}
          title={
            view.dialog?.kind === 'bulk'
              ? 'Bulk update testimonials'
              : view.dialog?.kind === 'new'
                ? 'Add testimonial'
                : 'Edit testimonial'
          }
          description={
            view.dialog?.kind === 'bulk'
              ? 'Add or update many testimonials at once from a CSV file.'
              : 'A quote from a family, shown on the website.'
          }
        >
          {view.dialog?.kind === 'bulk'
            ? bulkForm(view.closeDialog, (submit) => <DialogActions>{submit}</DialogActions>)
            : view.dialog &&
              testimonialForm(view.dialog, view.closeDialog, (submit) => (
                <DialogActions
                  start={
                    dialogTestimonial && (
                      <DeleteTestimonial
                        testimonial={dialogTestimonial}
                        disabled={pending}
                        onConfirm={() => remove(dialogTestimonial.id).then(view.closeDialog)}
                      />
                    )
                  }
                >
                  {submit}
                </DialogActions>
              ))}
        </ListDialog>
      )}
    </div>
  );
}

function TestimonialSummary({ testimonial }: { testimonial: Testimonial }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-medium">{testimonial.name}</span>
        {testimonial.featured && (
          <StarIcon aria-label="Featured" className="size-3 shrink-0 fill-current" />
        )}
        {testimonial.status === 'draft' && (
          <span className="text-muted-foreground shrink-0 text-xs">Draft</span>
        )}
      </span>
      <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{testimonial.quote}</span>
    </>
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
      {
        success: {
          title: testimonial ? 'Testimonial saved' : 'Testimonial added',
          description: published
            ? 'It shows on the website.'
            : 'It is a draft, so the website does not show it.',
        },
        error: 'Could not save the testimonial',
      }
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell label="Quote" htmlFor="t-quote">
          <Textarea
            id="t-quote"
            required
            rows={4}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="What they said, in their own words…"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <div className="grid grid-cols-2 gap-3 max-md:contents">
          <FormCell label="Name" htmlFor="t-name">
            <Input
              id="t-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
          </FormCell>
          <FormCell label="Relationship" htmlFor="t-relationship">
            <Input
              id="t-relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Customer"
            />
          </FormCell>
        </div>
        <FormCell label="Location" htmlFor="t-location">
          <Input
            id="t-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or town"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <ImageField
          id="t-photo"
          label="Photo"
          description="Optional. A photo of the person, with their permission."
          shape="square"
          mediaId={photoMediaId}
          onChange={setPhotoMediaId}
        />
      </FormSection>
      <FormSection>
        <FormSwitchCell
          id="t-featured"
          label="Featured"
          description="Highlight this quote on the site."
          checked={featured}
          onCheckedChange={setFeatured}
        />
        <FormSwitchCell
          id="t-published"
          label="Published"
          description="Show this quote on the website."
          checked={published}
          onCheckedChange={setPublished}
        />
      </FormSection>
      {footer(pending, testimonial === null)}
    </form>
  );
}
