import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAction } from '@/lib/use-action';
import {
  type Testimonial,
  type TestimonialsData,
  deleteTestimonial,
  saveTestimonial,
} from '@/server/testimonials';

export function TestimonialsPage({
  data,
  canWrite,
}: {
  data: TestimonialsData;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (testimonial: Testimonial) => {
    setEditing(testimonial);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Testimonials</h1>
          <p className="text-muted-foreground text-sm">
            Quotes from families, shown on the website.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add testimonial
          </Button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
          No testimonials yet.
        </div>
      ) : (
        <section className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">All</h2>
            <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <TestimonialsTable data={data} canWrite={canWrite} onEdit={openEdit} />
          </div>
        </section>
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

function TestimonialsTable({
  data,
  canWrite,
  onEdit,
}: {
  data: TestimonialsData;
  canWrite: boolean;
  onEdit: (testimonial: Testimonial) => void;
}) {
  const { run } = useAction();

  return (
    <Table className="[&_td]:px-4 [&_th]:px-4">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Quote</TableHead>
          <TableHead className="w-40">From</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((testimonial) => (
          <TableRow key={testimonial.id}>
            <TableCell className="py-2.5">
              <p className="line-clamp-2 max-w-md text-sm">{testimonial.quote}</p>
            </TableCell>
            <TableCell>
              <div className="text-sm font-medium">{testimonial.name}</div>
              {(testimonial.relationship || testimonial.location) && (
                <div className="text-muted-foreground text-xs">
                  {[testimonial.relationship, testimonial.location].filter(Boolean).join(' · ')}
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={testimonial.status === 'published' ? 'secondary' : 'outline'}
                  className="capitalize"
                >
                  {testimonial.status}
                </Badge>
                {testimonial.featured && <Badge variant="default">Featured</Badge>}
              </div>
            </TableCell>
            <TableCell>
              {canWrite && (
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit testimonial from ${testimonial.name}`}
                    onClick={() => onEdit(testimonial)}
                  >
                    <PencilIcon aria-hidden className="size-4" />
                  </Button>
                  <DeleteTestimonial
                    testimonial={testimonial}
                    onConfirm={() =>
                      run(
                        () => deleteTestimonial({ data: { id: testimonial.id } }),
                        'Testimonial removed.'
                      )
                    }
                  />
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeleteTestimonial({
  testimonial,
  onConfirm,
}: {
  testimonial: Testimonial;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
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
