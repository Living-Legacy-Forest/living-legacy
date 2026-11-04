import { useState } from 'react';
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
  ChevronDownIcon,
  ChevronUpIcon,
  PanelRightIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
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
import { ImageField } from '@/components/media/image-field';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { readStatus } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type TeamListData,
  type TeamMember,
  deleteTeamMember,
  deleteTeamMembers,
  importTeamMembers,
  moveTeamMember,
  saveTeamMember,
} from '@/server/team';

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

const NOUN: [string, string] = ['team member', 'team members'];

/** A CSV row's values as member fields, or what is wrong with them. */
function memberFromCsv(values: Record<string, string>) {
  const status = readStatus(values.status ?? '');
  if (!values.name) return 'The name is empty.';
  if (values.name.length > 80) return 'The name is over 80 characters.';
  if ((values.role ?? '').length > 60) return 'The role is over 60 characters.';
  if ((values.bio ?? '').length > 2000) return 'The bio is over 2000 characters.';
  if (!status) return 'The status must be draft or published.';
  return { name: values.name, role: values.role, bio: values.bio, status };
}

export function TeamPage({ data, canWrite }: { data: TeamListData; canWrite: boolean }) {
  // Desktop: who the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (set independently, see openNew/openEdit).
  const [editingId, setEditingId] = useState<string | 'new' | 'bulk' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<TeamMember | 'new' | 'bulk' | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selection = useSelection(data.map((m) => m.id));
  const { run, pending } = useAction();

  const selected = data.find((m) => m.id === editingId) ?? null;
  const visible = data.filter((m) => matchesSearch(query, [m.name, m.role, m.bio]));

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openBulk = () => (isDesktop() ? setEditingId('bulk') : setDialogTarget('bulk'));
  const openEdit = (member: TeamMember) =>
    isDesktop() ? setEditingId(member.id) : setDialogTarget(member);

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteTeamMembers({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
    if (!result) return;
    if (editingId && ids.includes(editingId)) setEditingId(null);
    selection.clear();
  }

  const bulkForm = (onDone: () => void, footer: (submit: React.ReactNode) => React.ReactNode) => (
    <BulkCsvForm
      noun={NOUN}
      fileName="team"
      fields={['name', 'role', 'bio', 'status']}
      example={{
        name: 'Jane Smith',
        role: 'Founder',
        bio: 'A short introduction.',
        status: 'draft',
      }}
      current={data.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role ?? '',
        bio: m.bio,
        status: m.status,
      }))}
      toRow={memberFromCsv}
      apply={(rows) => importTeamMembers({ data: { rows } })}
      onDone={onDone}
      footer={footer}
    />
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Team
        </h1>
        {data.length > 0 && (
          <SearchInput
            label="Search team members"
            placeholder="Search names and roles"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && (
          <>
            <Button size="sm" variant="outline" onClick={openBulk}>
              <UploadIcon aria-hidden data-icon="inline-start" />
              Bulk update
            </Button>
            <Button size="sm" onClick={openNew}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              Add member
            </Button>
          </>
        )}
      </div>

      {data.length === 0 && editingId === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No team members yet</EmptyTitle>
            <EmptyDescription>
              Add someone and they appear here, ready to be chosen as a post author.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && (
            <EmptyContent>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={openBulk}>
                  <UploadIcon aria-hidden data-icon="inline-start" />
                  Bulk update
                </Button>
                <Button size="sm" onClick={openNew}>
                  <PlusIcon aria-hidden data-icon="inline-start" />
                  Add member
                </Button>
              </div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_1fr]">
          <section aria-label="Team members" className="flex min-h-0 flex-col lg:border-r">
            {canWrite ? (
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((m) => m.id)}
                title="Members"
                total={data.length}
                pending={pending}
                onDelete={() => setConfirmDelete(true)}
              />
            ) : (
              <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-[13px] font-medium">Members</span>
                <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
              </div>
            )}
            {visible.length === 0 ? (
              <NoMatches onClear={() => setQuery('')} />
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((member) => {
                  const index = data.indexOf(member);
                  return (
                    <MemberListItem
                      key={member.id}
                      member={member}
                      selected={member.id === editingId}
                      checked={selection.isChecked(member.id)}
                      selecting={selection.checkedIds.length > 0}
                      onToggle={() => selection.toggle(member.id)}
                      // Reordering a filtered list would be confusing, so it waits for a clear search.
                      canMoveUp={!query && index > 0}
                      canMoveDown={!query && index < data.length - 1}
                      canWrite={canWrite}
                      onSelect={() => openEdit(member)}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="Edit member" className="hidden min-h-0 flex-col lg:flex">
            {!canWrite || editingId === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No member selected</EmptyTitle>
                  <EmptyDescription>
                    Choose someone from the list, or add a new member.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : editingId === 'bulk' ? (
              <BulkPane title="Bulk update team members">
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
              <MemberPane
                key={editingId}
                member={editingId === 'new' ? null : selected}
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
        description="They are removed from the website. Posts they authored keep their content."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(open) => !open && setDialogTarget(null)}
        >
          <DialogContent className={dialogTarget === 'bulk' ? 'sm:max-w-lg' : 'sm:max-w-sm'}>
            <DialogHeader>
              <DialogTitle>
                {dialogTarget === 'bulk'
                  ? 'Bulk update team members'
                  : dialogTarget === 'new'
                    ? 'Add member'
                    : 'Edit member'}
              </DialogTitle>
              <DialogDescription>
                {dialogTarget === 'bulk'
                  ? 'Add or update many members at once from a CSV file.'
                  : 'Shown on the website and available as a post author.'}
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
              <MemberForm
                member={dialogTarget === 'new' ? null : dialogTarget}
                onSaved={() => setDialogTarget(null)}
                footer={(pending) => (
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <SubmitButton pending={pending} isNew={dialogTarget === 'new'} />
                  </DialogFooter>
                )}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
      Nobody matches that search.
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

function MemberListItem({
  member,
  selected,
  checked,
  selecting,
  onToggle,
  canMoveUp,
  canMoveDown,
  canWrite,
  onSelect,
}: {
  member: TeamMember;
  selected: boolean;
  checked: boolean;
  selecting: boolean;
  onToggle: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canWrite: boolean;
  onSelect: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <li className={cn('group rounded-md', selected ? 'bg-accent' : 'hover:bg-muted/60')}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {canWrite && (
          <RowCheckbox
            label={`Select ${member.name}`}
            checked={checked}
            selecting={selecting}
            onToggle={onToggle}
          />
        )}
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left outline-none"
        >
          {member.photoMediaId && (
            <img
              src={`/api/media/${member.photoMediaId}`}
              alt=""
              loading="lazy"
              className="size-8 shrink-0 rounded-full border object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium">{member.name}</span>
              {member.status === 'draft' && (
                <Badge variant="outline" className="shrink-0">
                  Draft
                </Badge>
              )}
            </div>
            {member.role && (
              <div className="text-muted-foreground truncate text-xs">{member.role}</div>
            )}
          </div>
        </button>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${member.name} up`}
              disabled={!canMoveUp || pending}
              onClick={() =>
                run(() => moveTeamMember({ data: { id: member.id, direction: 'up' } }))
              }
            >
              <ChevronUpIcon aria-hidden className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${member.name} down`}
              disabled={!canMoveDown || pending}
              onClick={() =>
                run(() => moveTeamMember({ data: { id: member.id, direction: 'down' } }))
              }
            >
              <ChevronDownIcon aria-hidden className="size-4" />
            </Button>
          </div>
        )}
      </div>
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
        'Add member'
      ) : (
        'Save'
      )}
    </Button>
  );
}

/** The inline desktop pane: header with delete, scrollable form body. */
function MemberPane({
  member,
  onSaved,
  onClose,
}: {
  member: TeamMember | null;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b px-3">
        <span className="text-sm font-medium">{member ? member.name : 'New member'}</span>
        {member && (
          <div className="ml-auto">
            <DeleteMember
              member={member}
              disabled={pending}
              onConfirm={() =>
                run(() => deleteTeamMember({ data: { id: member.id } }), 'Member removed.').then(
                  onClose
                )
              }
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          <MemberForm
            member={member}
            onSaved={onSaved}
            footer={(formPending, isNew) => (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <SubmitButton pending={formPending} isNew={isNew} />
              </div>
            )}
          />
        </div>
      </div>
    </>
  );
}

function DeleteMember({
  member,
  disabled,
  onConfirm,
}: {
  member: TeamMember;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Remove ${member.name}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They are removed from the website. Posts they authored keep their content.
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

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function MemberForm({
  member,
  onSaved,
  footer,
}: {
  member: TeamMember | null;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [bio, setBio] = useState(member?.bio ?? '');
  const [published, setPublished] = useState(member?.status === 'published');
  const [photoMediaId, setPhotoMediaId] = useState(member?.photoMediaId ?? null);
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveTeamMember({
          data: {
            id: member?.id,
            name,
            role: role || undefined,
            bio: bio || undefined,
            status: published ? 'published' : 'draft',
            photoMediaId,
          },
        }),
      member ? 'Member updated.' : 'Member added.'
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="member-name">Name</Label>
        <Input
          id="member-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="member-role">Role</Label>
        <Input
          id="member-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Founder"
        />
      </div>
      <ImageField
        id="member-photo"
        label="Photo"
        description="A square portrait works best."
        shape="square"
        mediaId={photoMediaId}
        onChange={setPhotoMediaId}
      />
      <div className="space-y-1.5">
        <Label htmlFor="member-bio">Bio</Label>
        <Textarea
          id="member-bio"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short introduction, shown on the website."
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">Published</div>
          <div className="text-muted-foreground text-xs">Show this person on the website.</div>
        </div>
        <Switch checked={published} onCheckedChange={setPublished} />
      </div>
      {footer(pending, member === null)}
    </form>
  );
}
