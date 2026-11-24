import { useState } from 'react';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter, passes } from '@/components/list/list-filter';
import { ListSort, byNumber, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
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
import { FormCell, FormSection } from '@/components/form-cells';
import { FolderIcon, PlusIcon, TagIcon } from '@/components/icons';
import { PageActions } from '@/components/shell/page-actions';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  PaneActions,
  PaneColumn,
  PaneEmpty,
  PaneFrame,
  useFormDirty,
  useListPane,
} from '@/components/list/list-page';
import { SaveButton, useSaveFeedback } from '@/components/list/save-button';
import { LeaveDialog } from '@/components/editor-page/leave-dialog';
import { ListRow } from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { RevealWords } from '@/components/dashboard/reveal-words';
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
import { Textarea } from '@/components/ui/textarea';
import { reportInvalid } from '@/lib/form-validation';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
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

/** What the pane edits: a saved term, or a new one. */
type Target = { kind: 'edit'; id: string } | { kind: 'new' };

const SORTS = [
  { value: 'name-az', label: 'Name, A to Z' },
  { value: 'name-za', label: 'Name, Z to A' },
  { value: 'most', label: 'Most posts' },
  { value: 'fewest', label: 'Fewest posts' },
] as const;

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
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<string[]>([]);
  const [layout, setLayout] = useListView(`terms_${type}`);
  const grid = layout === 'grid';
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((t) => t.id));
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
  const [sort, setSort] = useListSort(SORTS);
  const ordered = sortedBy(sorted, sort, {
    'name-za': (a, b) => byText(b.name, a.name),
    most: (a, b) => byNumber(b.postCount, a.postCount) || byText(a.name, b.name),
    fewest: (a, b) => byNumber(a.postCount, b.postCount) || byText(a.name, b.name),
  });
  const visible = ordered.filter(
    (t) =>
      passes(usage, t.postCount > 0 ? 'used' : 'unused') &&
      matchesSearch(query, [t.name, t.slug, t.description])
  );

  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((t) => t.id === target.id) ?? null) : null;
  // A term removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !editing(view.pane) ? null : view.pane;

  async function remove(ids: string[]) {
    const result = await run(() => deleteTerms({ data: { type, ids } }), {
      success: {
        ...removedNotice(ids.length, noun),
        description: `${ids.length === 1 ? 'It is' : 'They are'} also taken off any posts.`,
      },
      error: 'Could not remove',
    });
    if (!result) return;
    view.closeIfShowing((t) => t.kind === 'edit' && ids.includes(t.id));
    selection.clear();
  }

  const form = (target: Target, onDone: (id: string | null) => void, actions: Actions) => {
    const term = editing(target);
    return (
      <TermForm
        key={target.kind === 'edit' ? target.id : 'new'}
        type={type}
        term={term}
        onSaved={onDone}
        onDirtyChange={view.reportDirty}
        footer={(submit) =>
          actions(
            submit,
            term && (
              <DeleteTerm
                type={type}
                term={term}
                onRemoved={() => view.closeIfShowing((t) => t.kind === 'edit' && t.id === term.id)}
              />
            )
          )
        }
      />
    );
  };

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text={title} />
        </h1>
        {data.length > 0 && (
          <SearchInput
            label={`Search ${noun[1]}`}
            placeholder={`Search ${noun[1]}`}
            value={query}
            onChange={setQuery}
          />
        )}
        {data.length > 0 && <ListSort options={SORTS} value={sort} onChange={setSort} />}
        {data.length > 0 && (
          <ListFilter
            groups={[
              {
                key: 'usage',
                label: 'Use',
                options: [
                  { value: 'used', label: 'On posts' },
                  { value: 'unused', label: 'Not on any post' },
                ],
              },
            ]}
            values={{ usage }}
            onChange={(_, next) => {
              setUsage(next);
              selection.clear();
            }}
            onClear={() => setUsage([])}
          />
        )}
        {data.length > 0 && (
          <ViewSwitch
            value={layout}
            onChange={(next) => {
              setLayout(next);
              selection.clear();
            }}
          />
        )}
        {canWrite && (
          <Button size="sm" className="max-md:hidden" onClick={() => view.open({ kind: 'new' })}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            New {noun[0]}
          </Button>
        )}
        {canWrite && (
          <PageActions
            edit={
              grid
                ? undefined
                : {
                    editing: selection.selecting,
                    onToggle: selection.selecting ? selection.clear : selection.startEditing,
                  }
            }
            add={{ label: `New ${noun[0]}`, onClick: () => view.open({ kind: 'new' }) }}
          />
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
              <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                New {noun[0]}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ListPageLayout resizable={{ key: 'terms', defaultShare: 0.5 }}>
          <ListColumn
            label={title}
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
              <NoMatches
                onClear={() => {
                  setQuery('');
                  setUsage([]);
                }}
              >
                No {noun[1]} match that search.
              </NoMatches>
            ) : grid ? (
              <ListCards>
                {visible.map((t) => (
                  <ListCard
                    key={t.id}
                    title={t.name}
                    largeTitle
                    current={pane?.kind === 'edit' && pane.id === t.id}
                    remove={
                      canWrite
                        ? { label: 'Delete', onAction: () => setToDelete([t.id]) }
                        : undefined
                    }
                    onOpen={() => canWrite && view.open({ kind: 'edit', id: t.id })}
                  >
                    <Badge variant="outline" className="w-fit tabular-nums">
                      {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
                    </Badge>
                    <CardMeta>
                      <span className="font-mono">/{t.slug}</span>
                    </CardMeta>
                    {t.description && (
                      <p className="text-muted-foreground line-clamp-2 text-xs">{t.description}</p>
                    )}
                  </ListCard>
                ))}
              </ListCards>
            ) : (
              <ListRows>
                {visible.map((t) => (
                  <ListRow
                    key={t.id}
                    current={pane?.kind === 'edit' && pane.id === t.id}
                    align="start"
                    select={
                      canWrite
                        ? {
                            label: `Select ${t.name}`,
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
                    onOpen={() => canWrite && view.open({ kind: 'edit', id: t.id })}
                  >
                    <TermSummary term={t} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn label={`Edit ${noun[0]}`}>
            {!canWrite || pane === null ? (
              <PaneEmpty
                title={`No ${noun[0]} selected`}
                description={`Choose one from the list, or create a new ${noun[0]}.`}
              />
            ) : (
              <PaneFrame
                title={pane.kind === 'edit' ? (editing(pane)?.name ?? title) : `New ${noun[0]}`}
              >
                {form(
                  pane,
                  (id) => view.setPane(id ? { kind: 'edit', id } : null),
                  (submit, start) => (
                    <PaneActions start={start} onCancel={view.closePane}>
                      {submit}
                    </PaneActions>
                  )
                )}
              </PaneFrame>
            )}
          </PaneColumn>
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={noun}
        description="Posts using them keep their content, but lose this label. This cannot be undone."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      <LeaveDialog blocker={view.leave} what={noun[0]} />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          title={view.dialog?.kind === 'edit' ? `Edit ${noun[0]}` : `New ${noun[0]}`}
          description={
            type === 'category'
              ? 'Groups posts into a section of the site.'
              : 'Labels posts with a topic readers can browse by.'
          }
        >
          {view.dialog &&
            form(view.dialog, view.dismissDialog, (submit, start) => (
              <DialogActions start={start}>{submit}</DialogActions>
            ))}
        </ListDialog>
      )}
    </div>
  );
}

/** The form's buttons, laid out for the pane or the dialog; `start` is the delete button. */
type Actions = (submit: React.ReactNode, start: React.ReactNode) => React.ReactNode;

function TermSummary({ term: t }: { term: Term }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-medium">{t.name}</span>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
        </Badge>
      </span>
      <span className="text-muted-foreground mt-0.5 block truncate font-mono text-xs">
        /{t.slug}
      </span>
      {t.description && (
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">{t.description}</span>
      )}
    </>
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
                {
                  success: {
                    title: `${type === 'category' ? 'Category' : 'Tag'} deleted`,
                    description: 'It is also taken off any posts.',
                  },
                  error: `Could not delete the ${type}`,
                }
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
  onDirtyChange,
  footer,
}: {
  type: TermType;
  term: Term | null;
  onSaved: (id: string | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  footer: (submit: React.ReactNode) => React.ReactNode;
}) {
  const [name, setName] = useState(term?.name ?? '');
  const [description, setDescription] = useState(term?.description ?? '');
  const { run, pending } = useAction();
  const form = useFormDirty([name, description], onDirtyChange);
  const feedback = useSaveFeedback({ editing: term !== null, dirty: form.dirty });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => saveTerm({ data: { id: term?.id, type, name, description } }), {
      success: feedback.toast({
        title: `${type === 'category' ? 'Category' : 'Tag'} ${term ? 'saved' : 'created'}`,
        description: term ? 'Posts that use it show the change.' : 'It can be added to posts now.',
      }),
      error: `Could not save the ${type}`,
    });
    // A form closed or replaced while it saved leaves the page as it is now.
    if (!result || !form.markSaved()) return;
    feedback.saved();
    onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5 [--form-gap:1.25rem] max-md:space-y-7">
      <FormSection>
        <FormCell label="Name" htmlFor="t-name">
          <Input
            id="t-name"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'category' ? 'e.g. News' : 'e.g. sustainability'}
          />
        </FormCell>
        <FormCell
          label="Description (optional)"
          htmlFor="t-description"
          hint={
            type === 'category'
              ? "Shown at the top of this category's page on the website, and as its SEO description."
              : undefined
          }
        >
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
        </FormCell>
      </FormSection>
      {footer(
        <SaveButton pending={pending} saved={feedback.showSaved}>
          {term ? 'Save' : `Create ${type}`}
        </SaveButton>
      )}
    </form>
  );
}
