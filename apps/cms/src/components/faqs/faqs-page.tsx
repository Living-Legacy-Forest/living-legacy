import { MAX_FAQ_TAGS, splitTags } from '@llf/content';
import { useState } from 'react';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import {
  BulkPane,
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  type Selection,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleHelpIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { readStatus } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
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
} from '@/server/faqs';
import { TagInput } from './tag-input';

const UNGROUPED = 'ungrouped';

/** What the editing surface shows: an FAQ, a blank FAQ (maybe pre-grouped) or a new group. */
type Target =
  | { kind: 'faq'; id: string }
  | { kind: 'new'; groupId?: string }
  | { kind: 'group' }
  | { kind: 'bulk' };

/** The targets that open a single FAQ or group form. */
type FormTarget = Exclude<Target, { kind: 'bulk' }>;

const targetKey = (t: Target) =>
  t.kind === 'faq' ? t.id : t.kind === 'new' ? `new-${t.groupId ?? UNGROUPED}` : t.kind;

const NOUN: [string, string] = ['FAQ', 'FAQs'];

/** Tag filter values besides a tag itself. */
const ALL_TAGS = 'all';
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

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function FaqsPage({ data, canWrite }: { data: FaqData; canWrite: boolean }) {
  // Desktop: what the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (as on the team page).
  const [paneTarget, setPaneTarget] = useState<Target | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState(ALL_TAGS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.faqs.map((f) => f.id));
  const { run, pending } = useAction();

  const open = (target: Target) => (isDesktop() ? setPaneTarget(target) : setDialogTarget(target));
  // Targets hold an id, so the form always edits the live row.
  const faqFor = (target: Target | null) =>
    target?.kind === 'faq' ? (data.faqs.find((f) => f.id === target.id) ?? null) : null;
  // An FAQ removed elsewhere closes the pane.
  const pane = paneTarget?.kind === 'faq' && !faqFor(paneTarget) ? null : paneTarget;
  const dialogFaq = faqFor(dialogTarget);

  const ungrouped = data.faqs.filter((f) => !f.groupId);
  const sections = [
    ...data.groups.map((g) => ({ group: g, faqs: data.faqs.filter((f) => f.groupId === g.id) })),
    ...(ungrouped.length > 0 ? [{ group: null, faqs: ungrouped }] : []),
  ];
  const knownTags = [...new Set(data.faqs.flatMap((f) => f.tags))].sort();
  const matchesTag = (f: Faq) =>
    tagFilter === ALL_TAGS ||
    (tagFilter === NO_TAG ? f.tags.length === 0 : f.tags.includes(tagFilter));
  const searching = query.trim() !== '' || tagFilter !== ALL_TAGS;
  const visibleSections = sections
    .map((s) => ({
      ...s,
      faqs: s.faqs.filter(
        (f) => matchesTag(f) && matchesSearch(query, [f.question, f.answer, ...f.tags])
      ),
    }))
    .filter((s) => !searching || s.faqs.length > 0);
  const tagItems = [
    { value: ALL_TAGS, label: 'All tags' },
    ...knownTags.map((tag) => ({ value: tag, label: tag })),
    { value: NO_TAG, label: 'No tag' },
  ];
  const visibleIds = visibleSections.flatMap((s) => s.faqs.map((f) => f.id));
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteFaqs({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
    if (!result) return;
    if (paneTarget?.kind === 'faq' && ids.includes(paneTarget.id)) setPaneTarget(null);
    selection.clear();
  }

  const bulkForm = (onDone: () => void, footer: (submit: React.ReactNode) => React.ReactNode) => (
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
      footer={footer}
    />
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">FAQs</h1>
        {data.faqs.length > 0 && (
          <SearchInput
            label="Search FAQs"
            placeholder="Search questions, answers, tags"
            value={query}
            onChange={setQuery}
          />
        )}
        {knownTags.length > 0 && (
          <Select
            items={tagItems}
            value={tagFilter}
            onValueChange={(value) => value && setTagFilter(value)}
          >
            <SelectTrigger
              aria-label="Filter by tag"
              size="sm"
              className="bg-muted/60 w-40 border-0 text-[13px] shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tagItems.map((item) => (
                <SelectItem key={item.value} value={item.value} className="text-[13px]">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canWrite && (
          <>
            <Button size="sm" variant="outline" onClick={() => open({ kind: 'bulk' })}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Bulk update
            </Button>
            <Button size="sm" variant="outline" onClick={() => open({ kind: 'group' })}>
              <FolderPlusIcon aria-hidden data-icon="inline-start" />
              New group
            </Button>
            <Button size="sm" onClick={() => open({ kind: 'new' })}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add FAQ
            </Button>
          </>
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
                <Button size="sm" variant="outline" onClick={() => open({ kind: 'bulk' })}>
                  <UploadIcon aria-hidden data-icon="inline-start" />
                  Bulk update
                </Button>
                <Button size="sm" onClick={() => open({ kind: 'new' })}>
                  <PlusIcon aria-hidden data-icon="inline-start" />
                  Add FAQ
                </Button>
              </div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_1fr]">
          <section aria-label="FAQs" className="flex min-h-0 flex-col lg:border-r">
            {canWrite ? (
              <SelectionBar
                selection={selection}
                visibleIds={visibleIds}
                title="All"
                total={data.faqs.length}
                pending={pending}
                onDelete={() => setConfirmDelete(true)}
              />
            ) : (
              <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-[13px] font-medium">All</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {data.faqs.length}
                </span>
              </div>
            )}
            {visibleSections.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                No FAQs match.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setTagFilter(ALL_TAGS);
                  }}
                >
                  Clear search and filter
                </Button>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1.5">
                {visibleSections.map((section) => (
                  <FaqSection
                    key={section.group?.id ?? UNGROUPED}
                    group={section.group}
                    faqs={section.faqs}
                    selectedId={pane?.kind === 'faq' ? pane.id : null}
                    canWrite={canWrite}
                    selection={selection}
                    searching={searching}
                    onSelect={(faq) => canWrite && open({ kind: 'faq', id: faq.id })}
                    onAdd={() => open({ kind: 'new', groupId: section.group?.id })}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Edit FAQ" className="hidden min-h-0 flex-col lg:flex">
            {!canWrite || pane === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No FAQ selected</EmptyTitle>
                  <EmptyDescription>Choose one from the list, or add a new FAQ.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : pane.kind === 'bulk' ? (
              <BulkPane title="Bulk update FAQs">
                {bulkForm(
                  () => setPaneTarget(null),
                  (submit) => (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPaneTarget(null)}>
                        Cancel
                      </Button>
                      {submit}
                    </div>
                  )
                )}
              </BulkPane>
            ) : (
              <EditPane
                key={targetKey(pane)}
                target={pane}
                faq={faqFor(pane)}
                groups={data.groups}
                knownTags={knownTags}
                onSaved={(saved) => setPaneTarget(saved)}
                onClose={() => setPaneTarget(null)}
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
        description="They are removed from the website. This cannot be undone."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(isOpen) => !isOpen && setDialogTarget(null)}
        >
          <DialogContent
            className={
              dialogTarget?.kind === 'group'
                ? 'sm:max-w-sm'
                : dialogTarget?.kind === 'bulk'
                  ? 'sm:max-w-lg'
                  : 'sm:max-w-md'
            }
          >
            {dialogTarget?.kind === 'bulk' && (
              <>
                <DialogHeader>
                  <DialogTitle>Bulk update FAQs</DialogTitle>
                  <DialogDescription>
                    Add or update many FAQs at once from a CSV file.
                  </DialogDescription>
                </DialogHeader>
                {bulkForm(
                  () => setDialogTarget(null),
                  (submit) => (
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>
                        Cancel
                      </DialogClose>
                      {submit}
                    </DialogFooter>
                  )
                )}
              </>
            )}
            {dialogTarget && dialogTarget.kind !== 'bulk' && (
              <>
                <DialogHeader>
                  <DialogTitle>{targetTitle(dialogTarget)}</DialogTitle>
                  <DialogDescription>
                    {dialogTarget.kind === 'group'
                      ? 'Groups organise FAQs on the website, e.g. "Pricing".'
                      : 'A question and answer, shown on the website.'}
                  </DialogDescription>
                </DialogHeader>
                <TargetForm
                  key={targetKey(dialogTarget)}
                  target={dialogTarget}
                  faq={dialogFaq}
                  groups={data.groups}
                  knownTags={knownTags}
                  onSaved={() => setDialogTarget(null)}
                  footer={(pending) => (
                    <DialogFooter>
                      {dialogFaq && (
                        <div className="mr-auto">
                          <DeleteFaq
                            faq={dialogFaq}
                            disabled={pending}
                            onRemoved={() => setDialogTarget(null)}
                          />
                        </div>
                      )}
                      <DialogClose render={<Button type="button" variant="outline" />}>
                        Cancel
                      </DialogClose>
                      <SubmitButton pending={pending} target={dialogTarget} />
                    </DialogFooter>
                  )}
                />
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function targetTitle(target: FormTarget) {
  if (target.kind === 'group') return 'New group';
  return target.kind === 'new' ? 'New FAQ' : 'Edit FAQ';
}

function FaqSection({
  group,
  faqs,
  selectedId,
  canWrite,
  selection,
  searching,
  onSelect,
  onAdd,
}: {
  group: FaqGroup | null;
  faqs: Faq[];
  selectedId: string | null;
  canWrite: boolean;
  selection: Selection;
  /** While searching the list is partial, so reordering waits. */
  searching: boolean;
  onSelect: (faq: Faq) => void;
  onAdd: () => void;
}) {
  const { run } = useAction();

  return (
    <section>
      <div className="flex h-8 items-center gap-2 px-1.5">
        <h2 className="text-muted-foreground text-xs font-medium">
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
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      run(
                        () => deleteFaqGroup({ data: { id: group.id } }),
                        'Group removed. Its FAQs are now ungrouped.'
                      )
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
      ) : (
        <ul className="space-y-px">
          {faqs.map((faq, index) => (
            <FaqListItem
              key={faq.id}
              faq={faq}
              selected={faq.id === selectedId}
              canWrite={canWrite}
              checked={selection.isChecked(faq.id)}
              selecting={selection.checkedIds.length > 0}
              onToggle={() => selection.toggle(faq.id)}
              canMoveUp={!searching && index > 0}
              canMoveDown={!searching && index < faqs.length - 1}
              onSelect={() => onSelect(faq)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FaqListItem({
  faq,
  selected,
  canWrite,
  checked,
  selecting,
  onToggle,
  canMoveUp,
  canMoveDown,
  onSelect,
}: {
  faq: Faq;
  selected: boolean;
  canWrite: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <li className={cn('group rounded-md', selected ? 'bg-accent' : 'hover:bg-muted/60')}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {canWrite && (
          <RowCheckbox
            label={`Select ${faq.question}`}
            checked={checked}
            selecting={selecting}
            onToggle={onToggle}
          />
        )}
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left outline-none"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium">{faq.question}</span>
            {faq.status === 'draft' && (
              <Badge variant="outline" className="shrink-0">
                Draft
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground truncate text-xs">{faq.answer}</div>
          {faq.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {faq.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-mono text-[11px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </button>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move up"
              disabled={!canMoveUp || pending}
              onClick={() => run(() => moveFaq({ data: { id: faq.id, direction: 'up' } }))}
            >
              <ChevronUpIcon aria-hidden className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move down"
              disabled={!canMoveDown || pending}
              onClick={() => run(() => moveFaq({ data: { id: faq.id, direction: 'down' } }))}
            >
              <ChevronDownIcon aria-hidden className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </li>
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
      ) : target.kind === 'group' ? (
        'Add group'
      ) : target.kind === 'new' ? (
        'Add FAQ'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header with delete, scrollable form body. */
function EditPane({
  target,
  faq,
  groups,
  knownTags,
  onSaved,
  onClose,
}: {
  target: FormTarget;
  faq: Faq | null;
  groups: FaqGroup[];
  knownTags: string[];
  onSaved: (saved: Target | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="truncate text-sm font-medium">
          {faq ? faq.question : targetTitle(target)}
        </span>
        {faq && (
          <div className="ml-auto">
            <DeleteFaq faq={faq} onRemoved={onClose} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          <TargetForm
            target={target}
            faq={faq}
            groups={groups}
            knownTags={knownTags}
            onSaved={onSaved}
            footer={(pending) => (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <SubmitButton pending={pending} target={target} />
              </div>
            )}
          />
        </div>
      </div>
    </>
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
              run(async () => {
                await deleteFaq({ data: { id: faq.id } });
                return true;
              }, 'FAQ removed.').then((removed) => removed && onRemoved())
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
  if (target.kind === 'group') return <GroupForm onSaved={() => onSaved(null)} footer={footer} />;
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
      faq ? 'FAQ updated.' : 'FAQ added.'
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="faq-question">Question</Label>
        <Input
          id="faq-question"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would people like to know?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="faq-answer">Answer</Label>
        <Textarea
          id="faq-answer"
          required
          rows={5}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="A clear, helpful answer…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="faq-group">Group</Label>
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
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="faq-tags">Tags</Label>
        <TagInput
          id="faq-tags"
          value={tags}
          onChange={(next) => setTags(next.slice(0, MAX_FAQ_TAGS))}
          suggestions={knownTags}
          placeholder="home, pricing"
        />
        <p className="text-muted-foreground text-xs">
          Where this FAQ appears on the website, e.g. home, pricing or a location. Press Enter or a
          comma after each tag.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Published</div>
          <div className="text-muted-foreground text-xs">Show this FAQ on the website.</div>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </div>
      {footer(pending)}
    </form>
  );
}

function GroupForm({
  onSaved,
  footer,
}: {
  onSaved: () => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  const [name, setName] = useState('');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => saveFaqGroup({ data: { name } }), 'Group added.');
    if (result) onSaved();
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pricing"
        />
        <p className="text-muted-foreground text-xs">
          Groups organise FAQs on the website, e.g. "Pricing".
        </p>
      </div>
      {footer(pending)}
    </form>
  );
}
