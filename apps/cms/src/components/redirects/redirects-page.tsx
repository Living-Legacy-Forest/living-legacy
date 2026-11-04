import { checkRedirect } from '@ll/content';
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
  ArrowRightIcon,
  PanelRightIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from '@/components/icons';
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
import { readYesNo } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type Redirect,
  type RedirectsData,
  deleteRedirect,
  deleteRedirects,
  importRedirects,
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

type Filter = 'all' | '301' | '302' | '410' | 'off' | 'unused';

const filterItems: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: '301', label: '301 - Permanent' },
  { value: '302', label: '302 - Temporary' },
  { value: '410', label: '410 - Removed' },
  { value: 'off', label: 'Turned off' },
  { value: 'unused', label: 'Never used' },
];

function matchesFilter(r: Redirect, filter: Filter) {
  if (filter === 'off') return !r.enabled;
  if (filter === 'unused') return r.hits === 0;
  return filter === 'all' || String(r.statusCode) === filter;
}

const NOUN: [string, string] = ['redirect', 'redirects'];

/** A CSV row's values as redirect fields, or what is wrong with them. */
function redirectFromCsv(values: Record<string, string>) {
  const statusCode = Number(values.type || 301);
  const problem = checkRedirect(values.from ?? '', values.to ?? '', statusCode);
  if (problem) return problem;
  // Blank means yes for these two, matching the form's defaults.
  const enabled = values.active ? readYesNo(values.active) : true;
  const keepQuery = values.keep_query ? readYesNo(values.keep_query) : true;
  if (enabled === null) return 'Active must be yes or no.';
  if (keepQuery === null) return 'Keep query must be yes or no.';
  if ((values.note ?? '').length > 200) return 'The note is over 200 characters.';
  return {
    fromPath: values.from!,
    toPath: statusCode === 410 ? '' : values.to!,
    statusCode,
    note: values.note,
    enabled,
    keepQuery,
  };
}

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function RedirectsPage({ data }: { data: RedirectsData }) {
  // Desktop: what the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (as on the team page).
  const [editingId, setEditingId] = useState<string | 'new' | 'bulk' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Redirect | 'new' | 'bulk' | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.map((r) => r.id));
  const { run, pending } = useAction();

  const selected = data.find((r) => r.id === editingId) ?? null;
  const visible = data.filter(
    (r) => matchesFilter(r, filter) && matchesSearch(query, [r.fromPath, r.toPath, r.note])
  );

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openBulk = () => (isDesktop() ? setEditingId('bulk') : setDialogTarget('bulk'));
  const openEdit = (r: Redirect) => (isDesktop() ? setEditingId(r.id) : setDialogTarget(r));

  const bulkForm = (onDone: () => void, footer: (submit: React.ReactNode) => React.ReactNode) => (
    <BulkCsvForm
      noun={NOUN}
      fileName="redirects"
      fields={['from', 'to', 'type', 'note', 'active', 'keep_query']}
      example={{
        from: '/old-page',
        to: '/new-page',
        type: '301',
        note: 'Why this exists',
        active: 'yes',
        keep_query: 'yes',
      }}
      current={data.map((r) => ({
        id: r.id,
        from: r.fromPath,
        to: r.toPath,
        type: String(r.statusCode),
        note: r.note ?? '',
        active: r.enabled ? 'yes' : 'no',
        keep_query: r.keepQuery ? 'yes' : 'no',
      }))}
      toRow={redirectFromCsv}
      apply={(rows) => importRedirects({ data: { rows } })}
      onDone={onDone}
      footer={footer}
    />
  );

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteRedirects({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? 'redirect' : 'redirects'} removed.`
    );
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Redirects
        </h1>
        {data.length > 0 && (
          <>
            <SearchInput
              label="Search redirects"
              placeholder="Search paths and notes"
              value={query}
              onChange={setQuery}
            />
            <Select
              items={filterItems}
              value={filter}
              onValueChange={(value) => value && setFilter(value as Filter)}
            >
              <SelectTrigger
                aria-label="Filter redirects"
                size="sm"
                className="bg-muted/60 w-40 border-0 text-[13px] shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-[13px]">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Button size="sm" variant="outline" onClick={openBulk}>
          <UploadIcon aria-hidden data-icon="inline-start" />
          Bulk update
        </Button>
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openBulk}>
                <UploadIcon aria-hidden data-icon="inline-start" />
                Bulk update
              </Button>
              <Button size="sm" onClick={openNew}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                Add redirect
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_minmax(0,1fr)]">
          <section aria-label="Redirects" className="flex min-h-0 flex-col lg:border-r">
            <SelectionBar
              selection={selection}
              visibleIds={visible.map((r) => r.id)}
              title="All"
              total={data.length}
              pending={pending}
              onDelete={() => setConfirmDelete(true)}
            />
            {visible.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                No redirects match.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Clear search and filter
                </Button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((r) => (
                  <RedirectListItem
                    key={r.id}
                    redirect={r}
                    selected={r.id === editingId}
                    checked={selection.isChecked(r.id)}
                    selecting={selection.checkedIds.length > 0}
                    onToggle={() => selection.toggle(r.id)}
                    onSelect={() => openEdit(r)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Edit redirect" className="hidden min-h-0 flex-col lg:flex">
            {editingId === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No redirect selected</EmptyTitle>
                  <EmptyDescription>
                    Choose one from the list, or add a new redirect.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : editingId === 'bulk' ? (
              <BulkPane title="Bulk update redirects">
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

      <ConfirmBulkDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selection.checkedIds.length}
        noun={NOUN}
        description="Those old paths will no longer redirect. This cannot be undone."
        onConfirm={removeChecked}
      />

      <Dialog open={dialogTarget !== null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent className={dialogTarget === 'bulk' ? 'sm:max-w-lg' : 'sm:max-w-md'}>
          <DialogHeader>
            <DialogTitle>
              {dialogTarget === 'bulk'
                ? 'Bulk update redirects'
                : dialogTarget === 'new'
                  ? 'Add redirect'
                  : 'Edit redirect'}
            </DialogTitle>
            <DialogDescription>
              {dialogTarget === 'bulk'
                ? 'Add or update many redirects at once from a CSV file.'
                : 'Send one URL to another.'}
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
            <RedirectForm
              key={dialogTarget === 'new' ? 'new' : dialogTarget?.id}
              redirect={dialogTarget === 'new' ? null : dialogTarget}
              onSaved={() => setDialogTarget(null)}
              footer={(formPending, isNew) => (
                <DialogFooter>
                  {dialogTarget && dialogTarget !== 'new' && (
                    <div className="mr-auto">
                      <DeleteRedirect
                        redirect={dialogTarget}
                        disabled={formPending}
                        onRemoved={() => setDialogTarget(null)}
                      />
                    </div>
                  )}
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
    </div>
  );
}

function RedirectListItem({
  redirect,
  selected,
  checked,
  selecting,
  onToggle,
  onSelect,
}: {
  redirect: Redirect;
  selected: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      className={cn(
        'group flex items-start gap-1 rounded-md pl-1.5',
        selected ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      <RowCheckbox
        label={`Select ${redirect.fromPath}`}
        checked={checked}
        selecting={selecting}
        onToggle={onToggle}
        className="mt-2.5"
      />
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          'focus-visible:ring-ring min-w-0 flex-1 rounded-md px-1.5 py-2 text-left outline-none focus-visible:ring-1',
          !redirect.enabled && 'opacity-60'
        )}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{redirect.fromPath}</span>
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
