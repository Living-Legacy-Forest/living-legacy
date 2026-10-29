import { ArrowRightIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAction } from '@/lib/use-action';
import {
  type Redirect,
  type RedirectsData,
  deleteRedirect,
  saveRedirect,
} from '@/server/redirects';

const codeItems = [
  { value: '301', label: '301 — Permanent' },
  { value: '302', label: '302 — Temporary' },
];

export function RedirectsPage({ data }: { data: RedirectsData }) {
  const [editing, setEditing] = useState<Redirect | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (r: Redirect) => {
    setEditing(r);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Redirects</h1>
          <p className="text-muted-foreground text-sm">
            Send old or changed URLs to the right page.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          Add redirect
        </Button>
      </div>

      {data.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No redirects yet</EmptyTitle>
            <EmptyDescription>Add one to point an old path at its new home.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openNew}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add redirect
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <section className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">All</h2>
            <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <RedirectsTable data={data} onEdit={openEdit} />
          </div>
        </section>
      )}

      <RedirectDialog
        key={editing?.id ?? 'new'}
        redirect={editing}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function RedirectsTable({ data, onEdit }: { data: RedirectsData; onEdit: (r: Redirect) => void }) {
  const { run } = useAction();

  return (
    <Table className="[&_td]:px-4 [&_th]:px-4">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>From → To</TableHead>
          <TableHead className="w-20">Type</TableHead>
          <TableHead className="w-16 text-right">Hits</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="py-2.5">
              <div className="flex items-center gap-2 font-mono text-[13px]">
                <span className="truncate">{r.fromPath}</span>
                <ArrowRightIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
                <span className="text-muted-foreground truncate">{r.toPath}</span>
              </div>
              {r.note && <div className="text-muted-foreground mt-0.5 text-xs">{r.note}</div>}
            </TableCell>
            <TableCell>
              <Badge variant={r.statusCode === 301 ? 'secondary' : 'outline'}>{r.statusCode}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
              {r.hits}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit redirect from ${r.fromPath}`}
                  onClick={() => onEdit(r)}
                >
                  <PencilIcon aria-hidden className="size-4" />
                </Button>
                <DeleteRedirect
                  redirect={r}
                  onConfirm={() =>
                    run(() => deleteRedirect({ data: { id: r.id } }), 'Redirect removed.')
                  }
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeleteRedirect({ redirect, onConfirm }: { redirect: Redirect; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove redirect from ${redirect.fromPath}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this redirect?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">{redirect.fromPath}</span> will no longer redirect. This
            cannot be undone.
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

function RedirectDialog({
  redirect,
  open,
  onOpenChange,
}: {
  redirect: Redirect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fromPath, setFromPath] = useState(redirect?.fromPath ?? '');
  const [toPath, setToPath] = useState(redirect?.toPath ?? '');
  const [statusCode, setStatusCode] = useState<'301' | '302'>(
    redirect ? (String(redirect.statusCode) as '301' | '302') : '301'
  );
  const [note, setNote] = useState(redirect?.note ?? '');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(
      () =>
        saveRedirect({
          data: {
            id: redirect?.id,
            fromPath,
            toPath,
            statusCode: Number(statusCode) as 301 | 302,
            note: note || undefined,
          },
        }),
      redirect ? 'Redirect updated.' : 'Redirect added.'
    );
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{redirect ? 'Edit redirect' : 'Add redirect'}</DialogTitle>
          <DialogDescription>Send one URL to another.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-from">Old path</Label>
            <Input
              id="r-from"
              required
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder="/old-page"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-to">Destination</Label>
            <Input
              id="r-to"
              required
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/new-page"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-type">Type</Label>
            <Select
              items={codeItems}
              value={statusCode}
              onValueChange={(value) => value && setStatusCode(value as '301' | '302')}
            >
              <SelectTrigger id="r-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {codeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-note">Note</Label>
            <Input
              id="r-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this exists (optional)"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : redirect ? (
                'Save'
              ) : (
                'Add redirect'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
