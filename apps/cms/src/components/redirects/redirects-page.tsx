import { ArrowRightIcon, PanelRightIcon, PlusIcon, Trash2Icon } from '@/components/icons';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Switch } from '@/components/ui/switch';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type Redirect,
  type RedirectsData,
  deleteRedirect,
  saveRedirect,
} from '@/server/redirects';

type Code = '301' | '302' | '410';

const codeItems: { value: Code; label: string }[] = [
  { value: '301', label: '301 - Permanent' },
  { value: '302', label: '302 - Temporary' },
  { value: '410', label: '410 - Removed, no replacement' },
];

const dateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' });

function usage(r: Redirect) {
  if (r.hits === 0) return 'Not used yet';
  const times = `Used ${r.hits} ${r.hits === 1 ? 'time' : 'times'}`;
  return r.lastHitAt ? `${times}, last on ${dateFormat.format(r.lastHitAt)}` : times;
}

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function RedirectsPage({ data }: { data: RedirectsData }) {
  // Desktop: what the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (as on the team page).
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Redirect | 'new' | null>(null);

  const selected = data.find((r) => r.id === editingId) ?? null;

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openEdit = (r: Redirect) => (isDesktop() ? setEditingId(r.id) : setDialogTarget(r));

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Redirects</h1>
        <Button size="sm" onClick={openNew}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          Add redirect
        </Button>
      </div>

      {data.length === 0 && editingId === null ? (
        <Empty className="flex-1 rounded-lg border">
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
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,2fr)_3fr]">
          <section aria-label="Redirects" className="flex min-h-0 flex-col lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <span className="text-[13px] font-medium">All</span>
              <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
            </div>
            <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
              {data.map((r) => (
                <RedirectListItem
                  key={r.id}
                  redirect={r}
                  selected={r.id === editingId}
                  onSelect={() => openEdit(r)}
                />
              ))}
            </ul>
          </section>

          <section aria-label="Edit redirect" className="hidden min-h-0 flex-col lg:flex">
            {editingId === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No redirect selected</EmptyTitle>
                  <EmptyDescription>Choose one from the list, or add a new redirect.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <RedirectPane
                key={editingId}
                redirect={editingId === 'new' ? null : selected}
                onSaved={(id) => setEditingId(id)}
                onClose={() => setEditingId(null)}
              />
            )}
          </section>
        </div>
      )}

      <Dialog open={dialogTarget !== null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTarget === 'new' ? 'Add redirect' : 'Edit redirect'}</DialogTitle>
            <DialogDescription>Send one URL to another.</DialogDescription>
          </DialogHeader>
          <RedirectForm
            key={dialogTarget === 'new' ? 'new' : dialogTarget?.id}
            redirect={dialogTarget === 'new' ? null : dialogTarget}
            onSaved={() => setDialogTarget(null)}
            footer={(pending, isNew) => (
              <DialogFooter>
                {dialogTarget && dialogTarget !== 'new' && (
                  <div className="mr-auto">
                    <DeleteRedirect
                      redirect={dialogTarget}
                      disabled={pending}
                      onRemoved={() => setDialogTarget(null)}
                    />
                  </div>
                )}
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancel
                </DialogClose>
                <SubmitButton pending={pending} isNew={isNew} />
              </DialogFooter>
            )}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RedirectListItem({
  redirect,
  selected,
  onSelect,
}: {
  redirect: Redirect;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li className={selected ? 'bg-accent rounded-md' : 'hover:bg-muted/60 rounded-md'}>
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          'focus-visible:ring-ring w-full rounded-md px-3 py-2 text-left outline-none focus-visible:ring-1',
          !redirect.enabled && 'opacity-60'
        )}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
            {redirect.fromPath}
          </span>
          {redirect.enabled ? (
            <Badge variant={redirect.statusCode === 301 ? 'secondary' : 'outline'}>
              {redirect.statusCode}
            </Badge>
          ) : (
            <Badge variant="outline">Off</Badge>
          )}
        </span>
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          {redirect.statusCode === 410 ? (
            <span className="min-w-0 flex-1 truncate">Removed</span>
          ) : (
            <>
              <ArrowRightIcon aria-hidden className="size-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono">{redirect.toPath}</span>
            </>
          )}
          <span className="shrink-0 tabular-nums">
            {redirect.hits} {redirect.hits === 1 ? 'hit' : 'hits'}
          </span>
        </span>
      </button>
    </li>
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
        'Add redirect'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header with delete, scrollable form body. */
function RedirectPane({
  redirect,
  onSaved,
  onClose,
}: {
  redirect: Redirect | null;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="truncate text-sm font-medium">
          {redirect ? <span className="font-mono">{redirect.fromPath}</span> : 'New redirect'}
        </span>
        {redirect && (
          <div className="ml-auto">
            <DeleteRedirect redirect={redirect} onRemoved={onClose} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          <RedirectForm
            redirect={redirect}
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

function DeleteRedirect({
  redirect,
  disabled,
  onRemoved,
}: {
  redirect: Redirect;
  disabled?: boolean;
  onRemoved: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || pending}
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
          <AlertDialogAction
            onClick={() =>
              run(async () => {
                await deleteRedirect({ data: { id: redirect.id } });
                return true;
              }, 'Redirect removed.').then((removed) => removed && onRemoved())
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function RedirectForm({
  redirect,
  onSaved,
  footer,
}: {
  redirect: Redirect | null;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
}) {
  const [fromPath, setFromPath] = useState(redirect?.fromPath ?? '');
  const [toPath, setToPath] = useState(redirect?.toPath ?? '');
  const [statusCode, setStatusCode] = useState<Code>(
    redirect ? (String(redirect.statusCode) as Code) : '301'
  );
  const [keepQuery, setKeepQuery] = useState(redirect?.keepQuery ?? true);
  const [enabled, setEnabled] = useState(redirect?.enabled ?? true);
  const [note, setNote] = useState(redirect?.note ?? '');
  const { run, pending } = useAction();
  const removed = statusCode === '410';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveRedirect({
          data: {
            id: redirect?.id,
            fromPath,
            toPath: removed ? '' : toPath,
            statusCode: Number(statusCode) as 301 | 302 | 410,
            enabled,
            keepQuery,
            note: note || undefined,
          },
        }),
      redirect ? 'Redirect updated.' : 'Redirect added.'
    );
    if (!result) return;
    for (const warning of result.warnings) toast.warning(warning);
    onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
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
        <p className="text-muted-foreground text-xs">
          End with * to cover everything under a path, like /blog/*.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-type">Type</Label>
        <Select
          items={codeItems}
          value={statusCode}
          onValueChange={(value) => value && setStatusCode(value as Code)}
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
        {removed && (
          <p className="text-muted-foreground text-xs">
            Visitors see the not-found page, and search engines drop the page sooner.
          </p>
        )}
      </div>
      {!removed && (
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
          <p className="text-muted-foreground text-xs">
            A path like /new-page or a full URL. A * here receives what the old path's * matched.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="r-note">Note</Label>
        <Input
          id="r-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why this exists (optional)"
        />
      </div>
      {!removed && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Keep query string</div>
            <div className="text-muted-foreground text-xs">
              Carry tracking tags like ?utm_source= over to the destination.
            </div>
          </div>
          <Switch checked={keepQuery} onCheckedChange={setKeepQuery} />
        </div>
      )}
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Active</div>
          <div className="text-muted-foreground text-xs">
            Turn off to pause this redirect without deleting it.
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      {redirect && <p className="text-muted-foreground text-xs">{usage(redirect)}.</p>}
      {footer(pending, redirect === null)}
    </form>
  );
}
