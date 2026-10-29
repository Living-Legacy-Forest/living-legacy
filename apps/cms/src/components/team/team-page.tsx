import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PanelRightIcon,
  PlusIcon,
  Trash2Icon,
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
import { useAction } from '@/lib/use-action';
import {
  type TeamListData,
  type TeamMember,
  deleteTeamMember,
  moveTeamMember,
  saveTeamMember,
} from '@/server/team';

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

export function TeamPage({ data, canWrite }: { data: TeamListData; canWrite: boolean }) {
  // Desktop: who the right-hand pane is editing. Mobile has no pane, so the
  // same form opens in a dialog instead (set independently, see openNew/openEdit).
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [dialogTarget, setDialogTarget] = useState<TeamMember | 'new' | null>(null);

  const selected = data.find((m) => m.id === editingId) ?? null;

  const openNew = () => (isDesktop() ? setEditingId('new') : setDialogTarget('new'));
  const openEdit = (member: TeamMember) =>
    isDesktop() ? setEditingId(member.id) : setDialogTarget(member);

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Team</h1>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add member
          </Button>
        )}
      </div>

      {data.length === 0 ? (
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
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,2fr)_3fr]">
          <section aria-label="Team members" className="flex min-h-0 flex-col lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
              <span className="text-[13px] font-medium">Members</span>
              <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
            </div>
            <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
              {data.map((member, index) => (
                <MemberListItem
                  key={member.id}
                  member={member}
                  selected={member.id === editingId}
                  canMoveUp={index > 0}
                  canMoveDown={index < data.length - 1}
                  canWrite={canWrite}
                  onSelect={() => openEdit(member)}
                />
              ))}
            </ul>
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

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(open) => !open && setDialogTarget(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{dialogTarget === 'new' ? 'Add member' : 'Edit member'}</DialogTitle>
              <DialogDescription>
                Shown on the website and available as a post author.
              </DialogDescription>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MemberListItem({
  member,
  selected,
  canMoveUp,
  canMoveDown,
  canWrite,
  onSelect,
}: {
  member: TeamMember;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canWrite: boolean;
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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <MemberForm
          member={member}
          onSaved={onSaved}
          footer={(formPending, isNew) => (
            <div className="flex justify-end">
              <SubmitButton pending={formPending} isNew={isNew} />
            </div>
          )}
        />
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
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(
      () =>
        saveTeamMember({
          data: {
            id: member?.id,
            name,
            role: role || undefined,
            bio: bio || undefined,
            status: published ? 'published' : 'draft',
          },
        }),
      member ? 'Member updated.' : 'Member added.'
    );
    if (result) onSaved(result.id);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
