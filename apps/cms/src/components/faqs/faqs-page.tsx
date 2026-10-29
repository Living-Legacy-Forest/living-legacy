import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleHelpIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
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

export function FaqsPage({ data, canWrite }: { data: FaqData; canWrite: boolean }) {
  const [editing, setEditing] = useState<Faq | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const openNew = (groupId?: string) => {
    setEditing(null);
    setDefaultGroupId(groupId);
    setOpen(true);
  };
  const openEdit = (faq: Faq) => {
    setEditing(faq);
    setOpen(true);
  };

  const ungrouped = data.faqs.filter((f) => !f.groupId);
  const sections = [
    ...data.groups.map((g) => ({ group: g, faqs: data.faqs.filter((f) => f.groupId === g.id) })),
    ...(ungrouped.length > 0 ? [{ group: null, faqs: ungrouped }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">FAQs</h1>
          <p className="text-muted-foreground text-sm">
            Questions and answers shown on the website.
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setGroupDialogOpen(true)}>
              <FolderPlusIcon aria-hidden data-icon="inline-start" />
              New group
            </Button>
            <Button size="sm" onClick={() => openNew()}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add FAQ
            </Button>
          </div>
        )}
      </div>

      {data.faqs.length === 0 ? (
        <Empty className="rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleHelpIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No FAQs yet</EmptyTitle>
            <EmptyDescription>Add a question and it appears here.</EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <Button size="sm" onClick={() => openNew()}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                Add FAQ
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <FaqSection
              key={section.group?.id ?? UNGROUPED}
              group={section.group}
              faqs={section.faqs}
              canWrite={canWrite}
              onEdit={openEdit}
              onAdd={() => openNew(section.group?.id)}
            />
          ))}
        </div>
      )}

      {canWrite && (
        <FaqDialog
          key={editing?.id ?? `new-${defaultGroupId ?? 'none'}`}
          faq={editing}
          groups={data.groups}
          defaultGroupId={defaultGroupId}
          open={open}
          onOpenChange={setOpen}
        />
      )}
      {canWrite && <GroupDialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen} />}
    </div>
  );
}

function FaqSection({
  group,
  faqs,
  canWrite,
  onEdit,
  onAdd,
}: {
  group: FaqGroup | null;
  faqs: Faq[];
  canWrite: boolean;
  onEdit: (faq: Faq) => void;
  onAdd: () => void;
}) {
  const { run } = useAction();

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{group ? group.name : 'Ungrouped'}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{faqs.length}</span>
        {canWrite && group && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onAdd}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={`${group.name} options`} />
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
          </div>
        )}
        {canWrite && !group && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto"
            onClick={onAdd}
          >
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <ul className="divide-y">
          {faqs.map((faq, index) => (
            <FaqRow
              key={faq.id}
              faq={faq}
              canWrite={canWrite}
              isFirst={index === 0}
              isLast={index === faqs.length - 1}
              onEdit={() => onEdit(faq)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqRow({
  faq,
  canWrite,
  isFirst,
  isLast,
  onEdit,
}: {
  faq: Faq;
  canWrite: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{faq.question}</p>
          {faq.status === 'draft' && (
            <Badge variant="outline" className="shrink-0">
              Draft
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">{faq.answer}</p>
      </div>
      {canWrite && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={isFirst || pending}
            onClick={() => run(() => moveFaq({ data: { id: faq.id, direction: 'up' } }))}
          >
            <ChevronUpIcon aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={isLast || pending}
            onClick={() => run(() => moveFaq({ data: { id: faq.id, direction: 'down' } }))}
          >
            <ChevronDownIcon aria-hidden className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Edit FAQ" onClick={onEdit}>
            <PencilIcon aria-hidden className="size-4" />
          </Button>
          <DeleteFaq
            faq={faq}
            onConfirm={() => run(() => deleteFaq({ data: { id: faq.id } }), 'FAQ removed.')}
          />
        </div>
      )}
    </li>
  );
}

function DeleteFaq({ faq, onConfirm }: { faq: Faq; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
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
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FaqDialog({
  faq,
  groups,
  defaultGroupId,
  open,
  onOpenChange,
}: {
  faq: Faq | null;
  groups: FaqGroup[];
  defaultGroupId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{faq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          <DialogDescription>A question and answer, shown on the website.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
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
              rows={4}
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : faq ? (
                'Save'
              ) : (
                'Add FAQ'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => saveFaqGroup({ data: { name } }), 'Group added.');
    if (result) {
      setName('');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Groups organise FAQs on the website, e.g. "Pricing".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pricing"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner />
                  Adding…
                </>
              ) : (
                'Add group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
