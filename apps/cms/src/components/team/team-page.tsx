import { useState } from 'react';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
} from '@/components/icons';
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
import { ListRow } from '@/components/list/list-row';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
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
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import {
  type TeamListData,
  type TeamMember,
  deleteTeamMember,
  deleteTeamMembers,
  importTeamMembers,
  moveTeamMember,
  saveTeamMember,
} from '@/server/team';

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

/** What the pane (or, on smaller screens, the dialog) shows. */
type Target = { kind: 'edit'; id: string } | { kind: 'new' } | { kind: 'bulk' };

export function TeamPage({ data, canWrite }: { data: TeamListData; canWrite: boolean }) {
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((m) => m.id));
  const { run, pending } = useAction();

  const memberFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((m) => m.id === target.id) ?? null) : null;
  // A member removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !memberFor(view.pane) ? null : view.pane;
  const visible = data.filter((m) => matchesSearch(query, [m.name, m.role, m.bio]));

  async function remove(ids: string[]) {
    const result = await run(() => deleteTeamMembers({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
  }

  const deleteButton = (member: TeamMember, onRemoved: () => void) => (
    <DeleteMember
      member={member}
      disabled={pending}
      onConfirm={() =>
        run(() => deleteTeamMember({ data: { id: member.id } }), {
          success: removedNotice(1, NOUN),
          error: 'Could not remove the team member',
        }).then(onRemoved)
      }
    />
  );

  const bulkForm = (onDone: () => void, actions: (submit: React.ReactNode) => React.ReactNode) => (
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
      footer={actions}
    />
  );

  const memberForm = (
    target: Target,
    onSaved: (id: string) => void,
    actions: (submit: React.ReactNode) => React.ReactNode
  ) => (
    <MemberForm
      key={target.kind === 'edit' ? target.id : target.kind}
      member={memberFor(target)}
      onSaved={onSaved}
      footer={(formPending, isNew) => actions(<SubmitButton pending={formPending} isNew={isNew} />)}
    />
  );

  const addButtons = (
    <>
      <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
        <UploadIcon aria-hidden data-icon="inline-start" />
        Bulk update
      </Button>
      <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
        <PlusIcon aria-hidden data-icon="inline-start" />
        Add member
      </Button>
    </>
  );

  const paneMember = memberFor(pane);
  const dialogMember = memberFor(view.dialog);

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
        {canWrite && addButtons}
      </div>

      {data.length === 0 && pane === null ? (
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
              <div className="flex gap-2">{addButtons}</div>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ListPageLayout>
          <ListColumn
            label="Team members"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((m) => m.id)}
                title="Members"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => setToDelete(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches onClear={() => setQuery('')}>Nobody matches that search.</NoMatches>
            ) : (
              <ListRows>
                {visible.map((member) => {
                  const index = data.indexOf(member);
                  return (
                    <ListRow
                      key={member.id}
                      current={pane?.kind === 'edit' && pane.id === member.id}
                      select={
                        canWrite
                          ? {
                              label: `Select ${member.name}`,
                              checked: selection.isChecked(member.id),
                              selecting: selection.selecting,
                              onToggle: () => selection.toggle(member.id),
                            }
                          : undefined
                      }
                      swipe={
                        canWrite
                          ? { label: 'Delete', onAction: () => setToDelete([member.id]) }
                          : undefined
                      }
                      actions={
                        canWrite && (
                          <MoveButtons
                            member={member}
                            // Reordering a filtered list would be confusing, so it waits for a clear search.
                            canMoveUp={!query && index > 0}
                            canMoveDown={!query && index < data.length - 1}
                          />
                        )
                      }
                      onOpen={() => canWrite && view.open({ kind: 'edit', id: member.id })}
                    >
                      <MemberSummary member={member} />
                    </ListRow>
                  );
                })}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn label="Edit member">
            {!canWrite || pane === null ? (
              <PaneEmpty
                title="No member selected"
                description="Choose someone from the list, or add a new member."
              />
            ) : pane.kind === 'bulk' ? (
              <PaneFrame title="Bulk update team members" width="lg">
                {bulkForm(view.closePane, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            ) : (
              <PaneFrame
                title={paneMember ? paneMember.name : 'New member'}
                actions={paneMember && deleteButton(paneMember, view.closePane)}
              >
                {memberForm(
                  pane,
                  (id) => view.setPane({ kind: 'edit', id }),
                  (submit) => (
                    <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
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
        noun={NOUN}
        description="They are removed from the website. Posts they authored keep their content."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          size={view.dialog?.kind === 'bulk' ? 'lg' : 'sm'}
          title={
            view.dialog?.kind === 'bulk'
              ? 'Bulk update team members'
              : view.dialog?.kind === 'new'
                ? 'Add member'
                : 'Edit member'
          }
          description={
            view.dialog?.kind === 'bulk'
              ? 'Add or update many members at once from a CSV file.'
              : 'Shown on the website and available as a post author.'
          }
        >
          {view.dialog?.kind === 'bulk'
            ? bulkForm(view.closeDialog, (submit) => <DialogActions>{submit}</DialogActions>)
            : view.dialog &&
              memberForm(view.dialog, view.closeDialog, (submit) => (
                <DialogActions start={dialogMember && deleteButton(dialogMember, view.closeDialog)}>
                  {submit}
                </DialogActions>
              ))}
        </ListDialog>
      )}
    </div>
  );
}

function MemberSummary({ member }: { member: TeamMember }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {member.photoMediaId && (
        <img
          src={`/api/media/${member.photoMediaId}?w=640`}
          alt=""
          loading="lazy"
          className="size-8 shrink-0 rounded-full border object-cover"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-ui truncate font-medium">{member.name}</span>
          {member.status === 'draft' && (
            <Badge variant="outline" className="shrink-0">
              Draft
            </Badge>
          )}
        </span>
        {member.role && (
          <span className="text-muted-foreground block truncate text-xs">{member.role}</span>
        )}
      </span>
    </span>
  );
}

function MoveButtons({
  member,
  canMoveUp,
  canMoveDown,
}: {
  member: TeamMember;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const { run, pending } = useAction();
  const move = (direction: 'up' | 'down') =>
    run(() => moveTeamMember({ data: { id: member.id, direction } }), {
      error: 'Could not move the team member',
    });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${member.name} up`}
        disabled={!canMoveUp || pending}
        onClick={() => move('up')}
      >
        <ChevronUpIcon aria-hidden className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${member.name} down`}
        disabled={!canMoveDown || pending}
        onClick={() => move('down')}
      >
        <ChevronDownIcon aria-hidden className="size-4" />
      </Button>
    </>
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
      {
        success: {
          title: member ? 'Team member saved' : 'Team member added',
          description: published
            ? 'They show on the website.'
            : 'They are a draft, so the website does not show them.',
        },
        error: 'Could not save the team member',
      }
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
