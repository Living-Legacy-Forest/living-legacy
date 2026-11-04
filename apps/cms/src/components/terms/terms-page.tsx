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
import {
  BulkPane,
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import { FolderIcon, PanelRightIcon, PlusIcon, TagIcon, Trash2Icon } from '@/components/icons';
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
import { Textarea } from '@/components/ui/textarea';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import { type Term, type TermsData, deleteTerms, saveTerm } from '@/server/terms';

type TermType = 'category' | 'tag';

const copy: Record<
  TermType,
  { title: string; noun: [string, string]; icon: typeof FolderIcon; emptyBody: string }
> = {
  category: {
    title: 'Categories',
    noun: ['category', 'categories'],
    icon: FolderIcon,
    emptyBody: 'Group posts into sections like News or Guides.',
  },
  tag: {
    title: 'Tags',
    noun: ['tag', 'tags'],
    icon: TagIcon,
    emptyBody: 'Label posts with topics readers can browse by.',
  },
};

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/** What the pane edits: a saved term, or a new one. */
type Target = { kind: 'edit'; id: string } | { kind: 'new' };

export function TermsPage({
  type,
  data,
  canWrite,
}: {
  type: TermType;
  data: TermsData;
  canWrite: boolean;
}) {
  const { title, noun, icon: Icon, emptyBody } = copy[type];
  const [paneTarget, setPaneTarget] = useState<Target | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.map((t) => t.id));
  const { run, pending } = useAction();

  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
  const visible = sorted.filter((t) => matchesSearch(query, [t.name, t.slug, t.description]));

  const open = (target: Target) => (isDesktop() ? setPaneTarget(target) : setDialogTarget(target));
  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((t) => t.id === target.id) ?? null) : null;
  // A term removed elsewhere closes the pane.
  const pane = paneTarget?.kind === 'edit' && !editing(paneTarget) ? null : paneTarget;

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteTerms({ data: { type, ids } }),
      `${ids.length} ${ids.length === 1 ? noun[0] : noun[1]} removed.`
    );
    if (!result) return;
    if (paneTarget?.kind === 'edit' && ids.includes(paneTarget.id)) setPaneTarget(null);
    selection.clear();
  }

  const form = (
    target: Target,
    onDone: (id: string | null) => void,
    footer: (submit: React.ReactNode) => React.ReactNode
  ) => (
    <TermForm
      key={target.kind === 'edit' ? target.id : 'new'}
      type={type}
      term={editing(target)}
      onSaved={onDone}
      footer={footer}
    />
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          {title}
        </h1>
        {data.length > 0 && (
          <SearchInput
            label={`Search ${noun[1]}`}
            placeholder={`Search ${noun[1]}`}
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && (
          <Button size="sm" onClick={() => open({ kind: 'new' })}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            New {noun[0]}
          </Button>
        )}
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No {noun[1]} yet</EmptyTitle>
            <EmptyDescription>{emptyBody}</EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <Button size="sm" onClick={() => open({ kind: 'new' })}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                New {noun[0]}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_minmax(0,1fr)]">
          <section aria-label={title} className="flex min-h-0 flex-col lg:border-r">
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
                No {noun[1]} match that search.
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((t) => (
                  <TermListItem
                    key={t.id}
                    term={t}
                    selected={pane?.kind === 'edit' && pane.id === t.id}
                    canWrite={canWrite}
                    checked={selection.isChecked(t.id)}
                    selecting={selection.checkedIds.length > 0}
                    onToggle={() => selection.toggle(t.id)}
                    onSelect={() => canWrite && open({ kind: 'edit', id: t.id })}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label={`Edit ${noun[0]}`} className="hidden min-h-0 flex-col lg:flex">
            {!canWrite || pane === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No {noun[0]} selected</EmptyTitle>
                  <EmptyDescription>
                    Choose one from the list, or create a new {noun[0]}.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <BulkPane
                title={pane.kind === 'edit' ? (editing(pane)?.name ?? title) : `New ${noun[0]}`}
              >
                {form(
                  pane,
                  (id) => setPaneTarget(id ? { kind: 'edit', id } : null),
                  (submit) => (
                    <div className="flex items-center gap-2">
                      {pane.kind === 'edit' && editing(pane) && (
                        <div className="mr-auto">
                          <DeleteTerm
                            type={type}
                            term={editing(pane)!}
                            onRemoved={() => setPaneTarget(null)}
                          />
                        </div>
                      )}
                      <Button type="button" variant="outline" onClick={() => setPaneTarget(null)}>
                        Cancel
                      </Button>
                      {submit}
                    </div>
                  )
                )}
              </BulkPane>
            )}
          </section>
        </div>
      )}

      <ConfirmBulkDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selection.checkedIds.length}
        noun={noun}
        description="Posts using them keep their content, but lose this label. This cannot be undone."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(isOpen) => !isOpen && setDialogTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialogTarget?.kind === 'edit' ? `Edit ${noun[0]}` : `New ${noun[0]}`}
              </DialogTitle>
              <DialogDescription>
                {type === 'category'
                  ? 'Groups posts into a section of the site.'
                  : 'Labels posts with a topic readers can browse by.'}
              </DialogDescription>
            </DialogHeader>
            {dialogTarget &&
              form(
                dialogTarget,
                () => setDialogTarget(null),
                (submit) => (
                  <DialogFooter>
                    {dialogTarget.kind === 'edit' && editing(dialogTarget) && (
                      <div className="mr-auto">
                        <DeleteTerm
                          type={type}
                          term={editing(dialogTarget)!}
                          onRemoved={() => setDialogTarget(null)}
                        />
                      </div>
                    )}
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    {submit}
                  </DialogFooter>
                )
              )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TermListItem({
  term: t,
  selected,
  canWrite,
  checked,
  selecting,
  onToggle,
  onSelect,
}: {
  term: Term;
  selected: boolean;
  canWrite: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      className={cn(
        'group flex items-start gap-1 rounded-md',
        canWrite && 'pl-1.5',
        selected ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      {canWrite && (
        <RowCheckbox
          label={`Select ${t.name}`}
          checked={checked}
          selecting={selecting}
          onToggle={onToggle}
          className="mt-2.5"
        />
      )}
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className="focus-visible:ring-ring min-w-0 flex-1 rounded-md px-1.5 py-2 text-left outline-none focus-visible:ring-1"
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.name}</span>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
          </Badge>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs">
          /{t.slug}
        </span>
        {t.description && (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {t.description}
          </span>
        )}
      </button>
    </li>
  );
}

function DeleteTerm({
  type,
  term,
  onRemoved,
}: {
  type: TermType;
  term: Term;
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
            size="sm"
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{term.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {term.postCount > 0
              ? `${term.postCount} ${term.postCount === 1 ? 'post uses' : 'posts use'} this ${type}. They keep their content, but lose this label. This cannot be undone.`
              : 'This cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              run(
                async () => {
                  await deleteTerms({ data: { type, ids: [term.id] } });
                  return true;
                },
                `${type === 'category' ? 'Category' : 'Tag'} deleted.`
              ).then((removed) => removed && onRemoved())
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function TermForm({
  type,
  term,
  onSaved,
  footer,
}: {
  type: TermType;
  term: Term | null;
  onSaved: (id: string | null) => void;
  footer: (submit: React.ReactNode) => React.ReactNode;
}) {
  const [name, setName] = useState(term?.name ?? '');
  const [description, setDescription] = useState(term?.description ?? '');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () => saveTerm({ data: { id: term?.id, type, name, description } }),
      term
        ? `${type === 'category' ? 'Category' : 'Tag'} saved.`
        : `${type === 'category' ? 'Category' : 'Tag'} created.`
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="t-name">Name</Label>
        <Input
          id="t-name"
          required
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'category' ? 'e.g. News' : 'e.g. sustainability'}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-description">Description (optional)</Label>
        <Textarea
          id="t-description"
          rows={3}
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            type === 'category' ? 'A sentence about this category' : 'A note for other editors'
          }
        />
        {type === 'category' && (
          <p className="text-muted-foreground text-xs">
            Shown at the top of this category's page on the website, and as its SEO description.
          </p>
        )}
      </div>
      {footer(
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : term ? (
            'Save'
          ) : (
            `Create ${type}`
          )}
        </Button>
      )}
    </form>
  );
}
