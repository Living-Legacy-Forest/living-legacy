import { MAX_FAQ_TAGS, slugify, splitTags } from '@ll/content';
import { useState } from 'react';
import { ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter, passes, publishStatusOptions } from '@/components/list/list-filter';
import { ListSort, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
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
  PaneEmpty,
  PaneFrame,
  useListPane,
} from '@/components/list/list-page';
import { ListRow, copyMenuItem, moveMenuItems, publishMenuItem } from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  type Selection,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleHelpIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { readStatus } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { removedNotice, statusNotice } from '@/lib/notify';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import {
  type Faq,
  type FaqData,
  type FaqGroup,
  deleteFaq,
  deleteFaqGroup,
  deleteFaqs,
  importFaqs,
  moveFaq,
  saveFaq,
  saveFaqGroup,
  setFaqStatus,
} from '@/server/faqs';
import { TagInput } from './tag-input';
import { FormBlock, FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { PageActions } from '@/components/shell/page-actions';

const UNGROUPED = 'ungrouped';

/** What the editing surface shows: an FAQ, a blank FAQ (maybe pre-grouped) or a group. */
type Target =
  | { kind: 'faq'; id: string }
  | { kind: 'new'; groupId?: string }
  | { kind: 'group'; id?: string }
  | { kind: 'bulk' };

/** The targets that open a single FAQ or group form. */
type FormTarget = Exclude<Target, { kind: 'bulk' }>;

const targetKey = (t: Target) =>
  t.kind === 'faq'
    ? t.id
    : t.kind === 'new'
      ? `new-${t.groupId ?? UNGROUPED}`
      : t.kind === 'group'
        ? `group-${t.id ?? 'new'}`
        : t.kind;

const NOUN: [string, string] = ['FAQ', 'FAQs'];

/** The Tag filter's value for FAQs without a tag. */
const NO_TAG = 'untagged';

/** A CSV row's values as FAQ fields, or what is wrong with them. */
function faqFromCsv(values: Record<string, string>) {
  const status = readStatus(values.status ?? '');
  if (!values.question) return 'The question is empty.';
  if (values.question.length > 200) return 'The question is over 200 characters.';
  if (!values.answer) return 'The answer is empty.';
  if (values.answer.length > 2000) return 'The answer is over 2000 characters.';
  if ((values.group ?? '').length > 80) return 'The group name is over 80 characters.';
  const tags = splitTags(values.tags ?? '');
  if (tags.length > MAX_FAQ_TAGS) return `An FAQ can have up to ${MAX_FAQ_TAGS} tags.`;
  if (!status) return 'The status must be draft or published.';
  return {
    question: values.question,
    answer: values.answer,
    group: values.group ?? '',
    tags,
    status,
  };
}

const SORTS = [
  { value: 'order', label: 'Your order' },
  { value: 'question-az', label: 'Question, A to Z' },
  { value: 'question-za', label: 'Question, Z to A' },
] as const;

export function FaqsPage({ data, canWrite }: { data: FaqData; canWrite: boolean }) {
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  // Ticked values per filter group; an empty group does not narrow the list.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [layout, setLayout] = useListView('faqs');
  const grid = layout === 'grid';
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.faqs.map((f) => f.id));
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  // Targets hold an id, so the form always edits the live row.
  const faqFor = (target: Target | null) =>
    target?.kind === 'faq' ? (data.faqs.find((f) => f.id === target.id) ?? null) : null;
  // An FAQ removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'faq' && !faqFor(view.pane) ? null : view.pane;

  const [sort, setSort] = useListSort(SORTS);
  const ungrouped = data.faqs.filter((f) => !f.groupId);
  const sections = [
    ...data.groups.map((g) => ({ group: g, faqs: data.faqs.filter((f) => f.groupId === g.id) })),
    ...(ungrouped.length > 0 ? [{ group: null, faqs: ungrouped }] : []),
  ];
  const knownTags = [...new Set(data.faqs.flatMap((f) => f.tags))].sort();
  const matchesTag = (f: Faq) =>
    !picked.tags?.length ||
    picked.tags.some((tag) => (tag === NO_TAG ? f.tags.length === 0 : f.tags.includes(tag)));
  const filtering = Object.values(picked).some((ticked) => ticked.length > 0);
  const searching = query.trim() !== '' || filtering;
  const visibleSections = sections
    .filter((s) => passes(picked.groups, s.group?.id ?? UNGROUPED))
    .map((s) => ({
      ...s,
      // Within each group: the groups stay in their own order.
      faqs: sortedBy(s.faqs, sort, {
        'question-az': (a, b) => byText(a.question, b.question),
        'question-za': (a, b) => byText(b.question, a.question),
      }).filter(
        (f) =>
          matchesTag(f) &&
          passes(picked.statuses, f.status) &&
          matchesSearch(query, [f.question, f.answer, ...f.tags])
      ),
    }))
    .filter((s) => !searching || s.faqs.length > 0);
  const clearFilters = () => {
    setPicked({});
    selection.clear();
  };
  const visibleIds = visibleSections.flatMap((s) => s.faqs.map((f) => f.id));
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));

  async function remove(ids: string[]) {
    const result = await run(() => deleteFaqs({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'faq' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  const bulkForm = (onDone: () => void, actions: (submit: React.ReactNode) => React.ReactNode) => (
    <BulkCsvForm
      noun={NOUN}
      fileName="faqs"
      fields={['question', 'answer', 'group', 'tags', 'status']}
      example={{
        question: 'How do I choose a tree?',
        answer: 'Our team can help you choose a native species.',
        group: 'Getting started',
        tags: 'home, pricing',
        status: 'draft',
      }}
      current={data.faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        group: (f.groupId && groupName.get(f.groupId)) || '',
        tags: f.tags.join(', '),
        status: f.status,
      }))}
      toRow={faqFromCsv}
      apply={(rows) => importFaqs({ data: { rows } })}
      onDone={onDone}
      footer={actions}
    />
  );

  const targetForm = (
    target: FormTarget,
    onSaved: (saved: Target | null) => void,
    actions: (submit: React.ReactNode, formPending: boolean) => React.ReactNode
  ) => (
    <TargetForm
      key={targetKey(target)}
      target={target}
      faq={faqFor(target)}
      groups={data.groups}
      knownTags={knownTags}
      onSaved={onSaved}
      footer={(formPending) =>
        actions(<SubmitButton pending={formPending} target={target} />, formPending)
      }
    />
  );

  const paneFaq = faqFor(pane);
  const dialogFaq = faqFor(view.dialog);

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text="FAQs" />
        </h1>
        {data.faqs.length > 0 && (
          <SearchInput
            label="Search FAQs"
            placeholder="Search questions, answers, tags"
            value={query}
            onChange={setQuery}
          />
        )}
        {data.faqs.length > 0 && <ListSort options={SORTS} value={sort} onChange={setSort} />}
        {data.faqs.length > 0 && (
          <ListFilter
            groups={[
              { key: 'statuses', label: 'Status', options: publishStatusOptions },
              {
                key: 'groups',
                label: 'Group',
                options: [
                  ...data.groups.map((g) => ({ value: g.id, label: g.name })),
                  ...(ungrouped.length > 0 ? [{ value: UNGROUPED, label: 'Ungrouped' }] : []),
                ],
              },
              {
                key: 'tags',
                label: 'Tag',
                options: knownTags.length
                  ? [
                      ...knownTags.map((tag) => ({ value: tag, label: tag })),
                      { value: NO_TAG, label: 'No tag' },
                    ]
                  : [],
              },
            ]}
            values={picked}
            onChange={(key, next) => {
              setPicked((prev) => ({ ...prev, [key]: next }));
              selection.clear();
            }}
            onClear={clearFilters}
          />
        )}
        {data.faqs.length > 0 && (
          <ViewSwitch
            value={layout}
            onChange={(next) => {
              setLayout(next);
              selection.clear();
            }}
          />
        )}
        {canWrite && (
          <div className="flex gap-3 max-md:hidden">
            <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Bulk update
            </Button>
            <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'group' })}>
              <FolderPlusIcon aria-hidden data-icon="inline-start" />
              New group
            </Button>
            <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add FAQ
            </Button>
          </div>
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
            add={{
              label: 'Add',
              items: [
                { label: 'Add FAQ', onClick: () => view.open({ kind: 'new' }) },
                { label: 'New group', onClick: () => view.open({ kind: 'group' }) },
              ],
            }}
            more={[{ label: 'Bulk update', onClick: () => view.open({ kind: 'bulk' }) }]}
          />
        )}
      </div>

      {sections.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelpIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No FAQs yet</EmptyTitle>
            <EmptyDescription>Add a question and it appears here.</EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
                  <UploadIcon aria-hidden data-icon="inline-start" />
                  Bulk update
                </Button>
                <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
                  <PlusIcon aria-hidden data-icon="inline-start" />
                  Add FAQ
                </Button>
              </div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ListPageLayout>
          <ListColumn
            label="FAQs"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visibleIds}
                title="All"
                total={data.faqs.length}
                pending={pending}
                onDelete={canWrite ? () => setToDelete(selection.checkedIds) : undefined}
              />
            }
          >
            {visibleSections.length === 0 ? (
              <NoMatches
                clearLabel="Clear search and filter"
                onClear={() => {
                  setQuery('');
                  clearFilters();
                }}
              >
                No FAQs match.
              </NoMatches>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1.5 max-md:flex-none max-md:space-y-6 max-md:overflow-visible max-md:p-0">
                {visibleSections.map((section) => (
                  <FaqSection
                    key={section.group?.id ?? UNGROUPED}
                    group={section.group}
                    faqs={section.faqs}
                    selectedId={pane?.kind === 'faq' ? pane.id : null}
                    canWrite={canWrite}
                    selection={selection}
                    // Moving a question only makes sense in its own order.
                    searching={searching || sort !== 'order'}
                    grid={grid}
                    onSelect={(faq) => canWrite && view.open({ kind: 'faq', id: faq.id })}
                    onDelete={(faq) => setToDelete([faq.id])}
                    onAdd={() => view.open({ kind: 'new', groupId: section.group?.id })}
                    onEditGroup={(id) => view.open({ kind: 'group', id })}
                  />
                ))}
              </div>
            )}
          </ListColumn>

          <PaneColumn label="Edit FAQ">
            {!canWrite || pane === null ? (
              <PaneEmpty
                title="No FAQ selected"
                description="Choose one from the list, or add a new FAQ."
              />
            ) : pane.kind === 'bulk' ? (
              <PaneFrame title="Bulk update FAQs" width="lg">
                {bulkForm(view.closePane, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            ) : (
              <PaneFrame
                title={paneFaq ? paneFaq.question : targetTitle(pane)}
                actions={paneFaq && <DeleteFaq faq={paneFaq} onRemoved={view.closePane} />}
              >
                {targetForm(pane, view.setPane, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            )}
          </PaneColumn>
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are removed from the website. This cannot be undone."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          size={view.dialog?.kind === 'group' ? 'sm' : view.dialog?.kind === 'bulk' ? 'lg' : 'md'}
          title={
            view.dialog?.kind === 'bulk'
              ? 'Bulk update FAQs'
              : view.dialog
                ? targetTitle(view.dialog)
                : ''
          }
          description={
            view.dialog?.kind === 'bulk'
              ? 'Add or update many FAQs at once from a CSV file.'
              : view.dialog?.kind === 'group'
                ? 'Groups organise FAQs on the website, e.g. "Pricing".'
                : 'A question and answer, shown on the website.'
          }
        >
          {view.dialog?.kind === 'bulk'
            ? bulkForm(view.closeDialog, (submit) => <DialogActions>{submit}</DialogActions>)
            : view.dialog &&
              targetForm(view.dialog, view.closeDialog, (submit, formPending) => (
                <DialogActions
                  start={
                    dialogFaq && (
                      <DeleteFaq
                        faq={dialogFaq}
                        disabled={formPending}
                        onRemoved={view.closeDialog}
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

function targetTitle(target: FormTarget) {
  if (target.kind === 'group') return target.id ? 'Edit group' : 'New group';
  return target.kind === 'new' ? 'New FAQ' : 'Edit FAQ';
}

function FaqSection({
  group,
  faqs,
  selectedId,
  canWrite,
  selection,
  searching,
  grid,
  onSelect,
  onDelete,
  onAdd,
  onEditGroup,
}: {
  group: FaqGroup | null;
  faqs: Faq[];
  selectedId: string | null;
  canWrite: boolean;
  selection: Selection;
  /** While searching the list is partial, so reordering waits. */
  searching: boolean;
  grid: boolean;
  onSelect: (faq: Faq) => void;
  onDelete: (faq: Faq) => void;
  onAdd: () => void;
  onEditGroup: (id: string) => void;
}) {
  const { run } = useAction();
  const faqMenu = (faq: Faq, index: number) =>
    canWrite
      ? [
          copyMenuItem('Question', faq.question),
          ...moveMenuItems(
            !searching && index > 0,
            !searching && index < faqs.length - 1,
            (direction) =>
              run(() => moveFaq({ data: { id: faq.id, direction } }), {
                error: 'Could not move the FAQ',
              })
          ),
          publishMenuItem(faq.status === 'published', (status) =>
            run(() => setFaqStatus({ data: { id: faq.id, status } }), {
              success: statusNotice(status),
              error: 'Could not change it',
            })
          ),
        ]
      : undefined;

  return (
    <section>
      <div className="flex h-8 items-center gap-2 px-1.5 max-md:px-4">
        <h2 className="text-muted-foreground text-xs font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
          {group ? group.name : 'Ungrouped'}
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">{faqs.length}</span>
        {canWrite && (
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Add FAQ to ${group ? group.name : 'Ungrouped'}`}
              className="text-muted-foreground"
              onClick={onAdd}
            >
              <PlusIcon aria-hidden className="size-4" />
            </Button>
            {group && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${group.name} options`}
                      className="text-muted-foreground"
                    />
                  }
                >
                  <MoreHorizontalIcon aria-hidden className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditGroup(group.id)}>
                    <PencilIcon aria-hidden />
                    Edit group
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      run(() => deleteFaqGroup({ data: { id: group.id } }), {
                        success: {
                          title: 'Group removed',
                          description: 'Its FAQs are kept, now without a group.',
                        },
                        error: 'Could not remove the group',
                      })
                    }
                  >
                    <Trash2Icon aria-hidden />
                    Delete group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
      {faqs.length === 0 ? (
        <p className="text-muted-foreground px-3 py-2 text-xs">No FAQs in this group yet.</p>
      ) : grid ? (
        <ListCards className="flex-none overflow-visible p-1.5 max-md:p-0">
          {faqs.map((faq, index) => (
            <ListCard
              key={faq.id}
              title={faq.question}
              largeTitle
              current={faq.id === selectedId}
              menu={faqMenu(faq, index)}
              remove={canWrite ? { label: 'Delete', onAction: () => onDelete(faq) } : undefined}
              onOpen={() => onSelect(faq)}
            >
              {faq.status === 'draft' && (
                <Badge variant="outline" className="w-fit">
                  Draft
                </Badge>
              )}
              <p className="text-muted-foreground line-clamp-3 text-xs">{faq.answer}</p>
              {faq.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {faq.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="font-mono text-[11px]">
                      {tag}
                    </Badge>
                  ))}
                </span>
              )}
            </ListCard>
          ))}
        </ListCards>
      ) : (
        <ListRows className="flex-none overflow-visible p-0">
          {faqs.map((faq, index) => (
            <ListRow
              key={faq.id}
              current={faq.id === selectedId}
              select={
                canWrite
                  ? {
                      label: `Select ${faq.question}`,
                      checked: selection.isChecked(faq.id),
                      selecting: selection.selecting,
                      onToggle: () => selection.toggle(faq.id),
                    }
                  : undefined
              }
              swipe={canWrite ? { label: 'Delete', onAction: () => onDelete(faq) } : undefined}
              menu={faqMenu(faq, index)}
              actions={
                canWrite && (
                  <MoveButtons
                    faq={faq}
                    canMoveUp={!searching && index > 0}
                    canMoveDown={!searching && index < faqs.length - 1}
                  />
                )
              }
              onOpen={() => onSelect(faq)}
            >
              <FaqSummary faq={faq} />
            </ListRow>
          ))}
        </ListRows>
      )}
    </section>
  );
}

function FaqSummary({ faq }: { faq: Faq }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="text-ui truncate font-medium">{faq.question}</span>
        {faq.status === 'draft' && (
          <Badge variant="outline" className="shrink-0">
            Draft
          </Badge>
        )}
      </span>
      <span className="text-muted-foreground block truncate text-xs">{faq.answer}</span>
      {faq.tags.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-1">
          {faq.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-mono text-[11px]">
              {tag}
            </Badge>
          ))}
        </span>
      )}
    </>
  );
}

function MoveButtons({
  faq,
  canMoveUp,
  canMoveDown,
}: {
  faq: Faq;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { run, pending } = useAction();
  const move = (direction: 'up' | 'down') =>
    run(() => moveFaq({ data: { id: faq.id, direction } }), { error: 'Could not move the FAQ' });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Move up"
        disabled={!canMoveUp || pending}
        onClick={() => move('up')}
      >
        <ChevronUpIcon aria-hidden className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Move down"
        disabled={!canMoveDown || pending}
        onClick={() => move('down')}
      >
        <ChevronDownIcon aria-hidden className="size-4" />
      </Button>
    </>
  );
}

function SubmitButton({ pending, target }: { pending: boolean; target: FormTarget }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : target.kind === 'group' && !target.id ? (
        'Add group'
      ) : target.kind === 'new' ? (
        'Add FAQ'
      ) : (
        'Save'
      )}
    </Button>
  );
}

function DeleteFaq({
  faq,
  disabled,
  onRemoved,
}: {
  faq: Faq;
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
            aria-label="Remove FAQ"
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this FAQ?</AlertDialogTitle>
          <AlertDialogDescription>
            “{faq.question}” is removed from the website. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              run(
                async () => {
                  await deleteFaq({ data: { id: faq.id } });
                  return true;
                },
                {
                  success: removedNotice(1, NOUN),
                  error: 'Could not remove the FAQ',
                }
              ).then((removed) => removed && onRemoved())
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The FAQ or group form for a target, used inline (desktop pane) and in the mobile dialog. */
function TargetForm({
  target,
  faq,
  groups,
  knownTags,
  onSaved,
  footer,
}: {
  target: FormTarget;
  faq: Faq | null;
  groups: FaqGroup[];
  knownTags: string[];
  onSaved: (saved: Target | null) => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  if (target.kind === 'group') {
    return (
      <GroupForm
        group={groups.find((g) => g.id === target.id) ?? null}
        onSaved={() => onSaved(null)}
        footer={footer}
      />
    );
  }
  return (
    <FaqForm
      faq={faq}
      groups={groups}
      knownTags={knownTags}
      defaultGroupId={target.kind === 'new' ? target.groupId : undefined}
      onSaved={(id) => onSaved({ kind: 'faq', id })}
      footer={footer}
    />
  );
}

function FaqForm({
  faq,
  groups,
  knownTags,
  defaultGroupId,
  onSaved,
  footer,
}: {
  faq: Faq | null;
  groups: FaqGroup[];
  knownTags: string[];
  defaultGroupId: string | undefined;
  onSaved: (id: string) => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  const [groupId, setGroupId] = useState(faq?.groupId ?? defaultGroupId ?? UNGROUPED);
  const [tags, setTags] = useState<string[]>(faq?.tags ?? []);
  const [published, setPublished] = useState(faq?.status === 'published');
  const { run, pending } = useAction();

  const groupItems = [
    { value: UNGROUPED, label: 'Ungrouped' },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveFaq({
          data: {
            id: faq?.id,
            question,
            answer,
            groupId: groupId === UNGROUPED ? undefined : groupId,
            tags,
            status: published ? 'published' : 'draft',
          },
        }),
      {
        success: {
          title: faq ? 'FAQ saved' : 'FAQ added',
          description: published
            ? 'It shows on the FAQ page.'
            : 'It is a draft, so the website does not show it.',
        },
        error: 'Could not save the FAQ',
      }
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell label="Question" htmlFor="faq-question">
          <Input
            id="faq-question"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would people like to know?"
          />
        </FormCell>
        <FormCell
          label="Answer"
          htmlFor="faq-answer"
          hint="Leave a blank line between paragraphs. For a link, write [the words](https://…)."
        >
          <Textarea
            id="faq-answer"
            required
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="A clear, helpful answer…"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <FormCell label="Group" htmlFor="faq-group">
          <Select items={groupItems} value={groupId} onValueChange={(v) => v && setGroupId(v)}>
            <SelectTrigger id="faq-group" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormCell>
      </FormSection>
      <FormBlock
        label="Tags"
        htmlFor="faq-tags"
        hint="Where this FAQ appears on the website, e.g. home, pricing or a location. Press Enter or a comma after each tag."
      >
        <TagInput
          id="faq-tags"
          value={tags}
          onChange={(next) => setTags(next.slice(0, MAX_FAQ_TAGS))}
          suggestions={knownTags}
          placeholder="home, pricing"
        />
      </FormBlock>
      <FormSection>
        <FormSwitchCell
          id="faq-published"
          label="Published"
          description="Show this FAQ on the website."
          checked={published}
          onCheckedChange={setPublished}
        />
      </FormSection>
      {footer(pending)}
    </form>
  );
}

function GroupForm({
  group,
  onSaved,
  footer,
}: {
  group: FaqGroup | null;
  onSaved: () => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [navLabel, setNavLabel] = useState(group?.navLabel ?? '');
  const [slug, setSlug] = useState(group?.slug ?? '');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () => saveFaqGroup({ data: { id: group?.id, name, navLabel, slug } }),
      {
        success: {
          title: group ? 'Group saved' : 'Group added',
          description: 'The FAQ page shows its published FAQs under it.',
        },
        error: 'Could not save the group',
      }
    );
    if (result) onSaved();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell label="Name" htmlFor="group-name" hint="The heading on the FAQs page.">
          <Input
            id="group-name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pricing"
          />
        </FormCell>
        <FormCell
          label="Menu label"
          htmlFor="group-nav-label"
          hint="Optional. A shorter name for the page's side menu."
        >
          <Input
            id="group-nav-label"
            maxLength={40}
            value={navLabel}
            onChange={(e) => setNavLabel(e.target.value)}
            placeholder={name || 'Same as the name'}
          />
        </FormCell>
        <FormCell
          label="Anchor"
          htmlFor="group-slug"
          hint={`Links straight to the group, as /faqs/#${slug || slugify(name) || 'anchor'}. Changing it breaks links that use the old one.`}
        >
          <Input
            id="group-slug"
            maxLength={60}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(slugify(slug))}
            placeholder={slugify(name) || 'made-from-the-name'}
            className="text-ui font-mono"
          />
        </FormCell>
      </FormSection>
      {footer(pending)}
    </form>
  );
}
