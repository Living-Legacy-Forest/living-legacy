import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  MessageSquareQuoteIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
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
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type Testimonial,
  type TestimonialsData,
  deleteTestimonial,
  saveTestimonial,
} from '@/server/testimonials';

type Search = { selected?: string };

function attribution(t: Testimonial): string {
  return [t.relationship, t.location].filter(Boolean).join(' · ');
}

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
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [open, setOpen] = useState(false);

  const selectedId = data.find((t) => t.id === search.selected)?.id ?? data[0]?.id ?? null;
  const selected = data.find((t) => t.id === selectedId) ?? null;
  const select = (id: string) =>
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setOpen(true);
  };
  const remove = (id: string) =>
    run(() => deleteTestimonial({ data: { id } }), 'Testimonial removed.');

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:min-h-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Testimonials</h1>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add testimonial
          </Button>
        )}
      </div>

      {data.length === 0 ? (
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
              <Button size="sm" onClick={openNew}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                Add testimonial
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,2fr)_3fr]">
          <section aria-label="Testimonials" className="flex min-h-0 flex-col lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <span className="text-[13px] font-medium">All</span>
              <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
            </div>
            <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
              {data.map((t) => (
                <TestimonialListItem
                  key={t.id}
                  testimonial={t}
                  selected={t.id === selectedId}
                  onSelect={() => select(t.id)}
                  onOpen={() => (canWrite ? openEdit(t) : select(t.id))}
                />
              ))}
            </ul>
          </section>

          <PreviewPane
            testimonial={selected}
            canWrite={canWrite}
            pending={pending}
            onEdit={openEdit}
            onDelete={remove}
          />
        </div>
      )}

      {canWrite && (
        <TestimonialDialog
          key={editing?.id ?? 'new'}
          testimonial={editing}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

function TestimonialListItem({
  testimonial,
  selected,
  onSelect,
  onOpen,
}: {
  testimonial: Testimonial;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      className={cn('rounded-md transition-colors', selected ? 'bg-accent' : 'hover:bg-muted/60')}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) onSelect();
          else onOpen();
        }}
        onDoubleClick={onOpen}
        className="focus-visible:ring-ring w-full rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-1"
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

function TestimonialDialog({
  testimonial,
  open,
  onOpenChange,
}: {
  testimonial: Testimonial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [quote, setQuote] = useState(testimonial?.quote ?? '');
  const [name, setName] = useState(testimonial?.name ?? '');
  const [relationship, setRelationship] = useState(testimonial?.relationship ?? '');
  const [location, setLocation] = useState(testimonial?.location ?? '');
  const [featured, setFeatured] = useState(testimonial?.featured ?? false);
  const [published, setPublished] = useState(testimonial?.status === 'published');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
          },
        }),
      testimonial ? 'Testimonial updated.' : 'Testimonial added.'
    );
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{testimonial ? 'Edit testimonial' : 'Add testimonial'}</DialogTitle>
          <DialogDescription>A quote from a family, shown on the website.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-quote">Quote</Label>
            <Textarea
              id="t-quote"
              required
              rows={4}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="It felt like we were giving something back…"
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
                placeholder="Daughter"
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : testimonial ? (
                'Save'
              ) : (
                'Add testimonial'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
