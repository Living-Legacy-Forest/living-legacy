import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleHelpIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PlusIcon,
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
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import {
  type Faq,
  type FaqData,
  type FaqGroup,
  deleteFaq,
  deleteFaqGroup,
  moveFaq,
  saveFaq,
  saveFaqGroup,
} from '@/server/faqs';

const UNGROUPED = 'ungrouped';

/** What the editing surface shows: an FAQ, a blank FAQ (maybe pre-grouped) or a new group. */
type Target = { kind: 'faq'; id: string } | { kind: 'new'; groupId?: string } | { kind: 'group' };

const targetKey = (t: Target) =>
  t.kind === 'faq' ? t.id : t.kind === 'new' ? `new-${t.groupId ?? UNGROUPED}` : 'group';

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function FaqsPage({ data, canWrite }: { data: FaqData; canWrite: boolean }) {
  // Desktop: what the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (as on the team page).
  const [paneTarget, setPaneTarget] = useState<Target | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null);

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

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">FAQs</h1>
        {canWrite && (
          <>
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
              <Button size="sm" onClick={() => open({ kind: 'new' })}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                Add FAQ
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,2fr)_3fr]">
          <section aria-label="FAQs" className="flex min-h-0 flex-col lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <span className="text-[13px] font-medium">All</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {data.faqs.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1.5">
              {sections.map((section) => (
                <FaqSection
                  key={section.group?.id ?? UNGROUPED}
                  group={section.group}
                  faqs={section.faqs}
                  selectedId={pane?.kind === 'faq' ? pane.id : null}
                  canWrite={canWrite}
                  onSelect={(faq) => canWrite && open({ kind: 'faq', id: faq.id })}
                  onAdd={() => open({ kind: 'new', groupId: section.group?.id })}
                />
              ))}
            </div>
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
            ) : (
              <EditPane
                key={targetKey(pane)}
                target={pane}
                faq={faqFor(pane)}
                groups={data.groups}
                onSaved={(saved) => setPaneTarget(saved)}
                onClose={() => setPaneTarget(null)}
              />
            )}
          </section>
        </div>
      )}

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(isOpen) => !isOpen && setDialogTarget(null)}
        >
          <DialogContent className={dialogTarget?.kind === 'group' ? 'sm:max-w-sm' : 'sm:max-w-md'}>
            {dialogTarget && (
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

function targetTitle(target: Target) {
  if (target.kind === 'group') return 'New group';
  return target.kind === 'new' ? 'New FAQ' : 'Edit FAQ';
}

function FaqSection({
  group,
  faqs,
  selectedId,
  canWrite,
  onSelect,
  onAdd,
}: {
  group: FaqGroup | null;
  faqs: Faq[];
  selectedId: string | null;
  canWrite: boolean;
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
              canMoveUp={index > 0}
              canMoveDown={index < faqs.length - 1}
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
  canMoveUp,
  canMoveDown,
  onSelect,
}: {
  faq: Faq;
  selected: boolean;
  canWrite: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <li className={selected ? 'bg-accent rounded-md' : 'hover:bg-muted/60 rounded-md'}>
      <div className="flex items-center gap-1 px-1.5 py-1">
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

function SubmitButton({ pending, target }: { pending: boolean; target: Target }) {
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
  onSaved,
  onClose,
}: {
  target: Target;
  faq: Faq | null;
  groups: FaqGroup[];
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
  onSaved,
  footer,
}: {
  target: Target;
  faq: Faq | null;
  groups: FaqGroup[];
  onSaved: (saved: Target | null) => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  if (target.kind === 'group') return <GroupForm onSaved={() => onSaved(null)} footer={footer} />;
  return (
    <FaqForm
      faq={faq}
      groups={groups}
      defaultGroupId={target.kind === 'new' ? target.groupId : undefined}
      onSaved={(id) => onSaved({ kind: 'faq', id })}
      footer={footer}
    />
  );
}

function FaqForm({
  faq,
  groups,
  defaultGroupId,
  onSaved,
  footer,
}: {
  faq: Faq | null;
  groups: FaqGroup[];
  defaultGroupId: string | undefined;
  onSaved: (id: string) => void;
  footer: (pending: boolean) => React.ReactNode;
}) {
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  const [groupId, setGroupId] = useState(faq?.groupId ?? defaultGroupId ?? UNGROUPED);
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
          placeholder="How do I choose a tree?"
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
          placeholder="Our team can help you choose a native species…"
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
