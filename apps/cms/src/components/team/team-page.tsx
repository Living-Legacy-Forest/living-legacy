import { useState } from 'react';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from '@/components/icons';
import { LeaveDialog } from '@/components/editor-page/leave-dialog';
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
  useFormDirty,
} from '@/components/list/list-page';
import { SaveButton, useSaveFeedback } from '@/components/list/save-button';
import { ListRow, moveMenuItems, publishMenuItem } from '@/components/list/list-row';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter, optionsOf, publishStatusOptions } from '@/components/list/list-filter';
import { ListSort, byNumber, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { useListView } from '@/components/list/view-switch';
import { ListDisplay } from '@/components/list/list-display';
import {
  ToolbarSearch,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { PageActions } from '@/components/shell/page-actions';
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
import { Textarea } from '@/components/ui/textarea';
import { readStatus } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { deletedNotice, restoredNotice, statusNotice } from '@/lib/notify';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import {
  type TeamListData,
  type TeamMember,
  deleteTeamMembers,
  importTeamMembers,
  moveTeamMember,
  restoreTeamMembers,
  saveTeamMember,
  setTeamMemberStatus,
} from '@/server/team';
import { avatarUrl, initialsOf } from '@/lib/avatar';
import { AvatarPicker } from '@/components/avatar-picker';
import { dateFacts, dateOptions, rowPasses, type MatchMode } from '@/components/list/filter-tools';

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

const SORTS = [
  { value: 'order', label: 'Your order' },
  { value: 'name-az', label: 'Name, A to Z' },
  { value: 'name-za', label: 'Name, Z to A' },
  { value: 'role-az', label: 'Role, A to Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
] as const;

export function TeamPage({ data, canWrite }: { data: TeamListData; canWrite: boolean }) {
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [match, setMatch] = useState<MatchMode>('all');
  const filtering = Object.values(picked).some((ticked) => ticked.length > 0);
  const [layout, setLayout] = useListView('team');
  const grid = layout === 'grid';
  const selection = useSelection(data.map((m) => m.id));
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  const memberFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((m) => m.id === target.id) ?? null) : null;
  // A member removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !memberFor(view.pane) ? null : view.pane;
  const [sort, setSort] = useListSort(SORTS);
  const ordered = sortedBy(data, sort, {
    'name-az': (a, b) => byText(a.name, b.name),
    'name-za': (a, b) => byText(b.name, a.name),
    'role-az': (a, b) => byText(a.role, b.role) || byText(a.name, b.name),
    newest: (a, b) => byNumber(b.createdAt, a.createdAt),
    oldest: (a, b) => byNumber(a.createdAt, b.createdAt),
  });
  const visible = ordered.filter(
    (m) =>
      rowPasses(match, picked, {
        statuses: m.status,
        roles: m.role,
        photo: m.photoMediaId ? 'yes' : 'no',
        added: dateFacts(m.createdAt),
      }) && matchesSearch(query, [m.name, m.role, m.bio])
  );
  // Reordering a narrowed list would be confusing, so it waits for a clear search and filter.
  // A different sort is a different order too, and moving a member only makes sense in their own.
  const narrowed = Boolean(query) || filtering || sort !== 'order';

  // Straight away, with Undo on the toast, rather than asking first.
  async function remove(ids: string[]) {
    const result = await run(() => deleteTeamMembers({ data: { ids } }), {
      success: deletedNotice(ids.length, NOUN, () => restore(ids)),
      error: 'Could not delete',
    });
    if (!result) return false;
    view.closeIfShowing((t) => t.kind === 'edit' && ids.includes(t.id));
    selection.clear();
    return true;
  }

  const restore = (ids: string[]) =>
    run(() => restoreTeamMembers({ data: { ids } }), {
      success: restoredNotice(ids.length, NOUN),
      error: 'Could not bring it back',
    });

  const memberMenu = (member: TeamMember) => {
    const index = data.indexOf(member);
    return [
      ...moveMenuItems(!narrowed && index > 0, !narrowed && index < data.length - 1, (direction) =>
        run(() => moveTeamMember({ data: { id: member.id, direction } }), {
          error: 'Could not move the team member',
        })
      ),
      publishMenuItem(member.status === 'published', (status) =>
        run(() => setTeamMemberStatus({ data: { id: member.id, status } }), {
          success: statusNotice(status),
          error: 'Could not change it',
        })
      ),
    ];
  };

  const deleteButton = (member: TeamMember) => (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Delete ${member.name}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={() => void remove([member.id])}
    >
      <Trash2Icon aria-hidden className="size-4" />
    </Button>
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
      onDirtyChange={view.reportDirty}
      footer={(formPending, isNew, saved) =>
        actions(
          <SaveButton pending={formPending} saved={saved}>
            {isNew ? 'Add member' : 'Save'}
          </SaveButton>
        )
      }
    />
  );

  const addButtons = (
    <>
      <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
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
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3 md:gap-1.5">
        <h1 data-slot="page-title" className="mr-auto text-xl md:sr-only">
          <RevealWords text="Team" />
        </h1>
        <div className="mr-auto max-md:hidden" />
        {data.length > 0 && (
          <ToolbarSearch
            label="Search team members"
            placeholder="Search names and roles"
            value={query}
            onChange={setQuery}
          />
        )}
        {data.length > 0 && (
          <ListSort options={SORTS} value={sort} onChange={setSort} hideOnDesktop />
        )}

        {data.length > 0 && (
          <ListDisplay
            filter={
              <ListFilter
                groups={[
                  { key: 'statuses', label: 'Status', options: publishStatusOptions },
                  { key: 'roles', label: 'Role', options: optionsOf(data.map((m) => m.role)) },
                  {
                    key: 'photo',
                    label: 'Photo',
                    options: [
                      { value: 'yes', label: 'Has a photo' },
                      { value: 'no', label: 'No photo' },
                    ],
                  },
                  { key: 'added', label: 'Added', options: dateOptions },
                ]}
                values={picked}
                onChange={(key, next) => {
                  setPicked((prev) => ({ ...prev, [key]: next }));
                  selection.clear();
                }}
                onClear={() => setPicked({})}
                match={match}
                onMatchChange={setMatch}
                savedKey="team"
              />
            }
            sortOptions={SORTS}
            sortValue={sort}
            onSortChange={(next) => setSort(next as typeof sort)}
            value={layout}
            onChange={(next) => {
              setLayout(next);
              selection.clear();
            }}
          />
        )}
        {canWrite && <div className="flex gap-3 max-md:hidden">{addButtons}</div>}
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
            add={{ label: 'Add member', onClick: () => view.open({ kind: 'new' }) }}
            more={[{ label: 'Bulk update', onClick: () => view.open({ kind: 'bulk' }) }]}
          />
        )}
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg">
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
        <ListPageLayout resizable={{ key: 'team', defaultShare: 0.5 }}>
          <ListColumn
            label="Team members"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((m) => m.id)}
                title="Members"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => void remove(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches
                onClear={() => {
                  setQuery('');
                  setPicked({});
                }}
              >
                Nobody matches that search.
              </NoMatches>
            ) : grid ? (
              <ListCards>
                {visible.map((member) => (
                  <ListCard
                    key={member.id}
                    title={member.name}
                    image={memberImage(member)}
                    icon={<span className="text-lg font-medium">{initialsOf(member.name)}</span>}
                    imagePosition="top"
                    current={pane?.kind === 'edit' && pane.id === member.id}
                    onOpen={() => canWrite && view.open({ kind: 'edit', id: member.id })}
                    menu={canWrite ? memberMenu(member) : undefined}
                    remove={
                      canWrite
                        ? { label: 'Delete', onAction: () => void remove([member.id]) }
                        : undefined
                    }
                  >
                    {member.status === 'draft' && (
                      <Badge variant="outline" className="w-fit">
                        Draft
                      </Badge>
                    )}
                    {member.role && <CardMeta>{member.role}</CardMeta>}
                  </ListCard>
                ))}
              </ListCards>
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
                          ? { label: 'Delete', onAction: () => void remove([member.id]) }
                          : undefined
                      }
                      menu={canWrite ? memberMenu(member) : undefined}
                      actions={
                        canWrite && (
                          <MoveButtons
                            member={member}
                            canMoveUp={!narrowed && index > 0}
                            canMoveDown={!narrowed && index < data.length - 1}
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
                actions={paneMember && deleteButton(paneMember)}
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

      <LeaveDialog blocker={view.leave} what="team member" />

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
            ? bulkForm(view.dismissDialog, (submit) => <DialogActions>{submit}</DialogActions>)
            : view.dialog &&
              memberForm(view.dialog, view.dismissDialog, (submit) => (
                <DialogActions start={dialogMember && deleteButton(dialogMember)}>
                  {submit}
                </DialogActions>
              ))}
        </ListDialog>
      )}
    </div>
  );
}

function memberImage(member: TeamMember) {
  if (member.photoMediaId) return `/api/media/${member.photoMediaId}?w=640`;
  return member.avatarSeed ? avatarUrl(member.avatarSeed) : null;
}

function MemberSummary({ member }: { member: TeamMember }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {memberImage(member) ? (
        <img
          src={memberImage(member)!}
          alt=""
          loading="lazy"
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {initialsOf(member.name)}
        </span>
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

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function MemberForm({
  member,
  onSaved,
  onDirtyChange,
  footer,
}: {
  member: TeamMember | null;
  onSaved: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  footer: (pending: boolean, isNew: boolean, saved: boolean) => React.ReactNode;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [bio, setBio] = useState(member?.bio ?? '');
  const [published, setPublished] = useState(member?.status === 'published');
  const [photoMediaId, setPhotoMediaId] = useState(member?.photoMediaId ?? null);
  const [avatarSeed, setAvatarSeed] = useState(member?.avatarSeed ?? null);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const { run, pending } = useAction();
  const form = useFormDirty([name, role, bio, published, photoMediaId, avatarSeed], onDirtyChange);
  const feedback = useSaveFeedback({ editing: member !== null, dirty: form.dirty });

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
            avatarSeed,
          },
        }),
      {
        success: feedback.toast({
          title: member ? 'Team member saved' : 'Team member added',
          description: published
            ? 'They show on the website.'
            : 'They are a draft, so the website does not show them.',
        }),
        error: 'Could not save the team member',
      }
    );
    // A form closed, replaced or edited again while it saved stays as it is now.
    if (!result || !form.markSaved(member === null)) return;
    feedback.saved();
    onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell label="Name" htmlFor="member-name">
          <Input
            id="member-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
          />
        </FormCell>
        <FormCell label="Role" htmlFor="member-role">
          <Input
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Founder"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <ImageField
          id="member-photo"
          label="Photo"
          description="A square portrait works best."
          shape="square"
          mediaId={photoMediaId}
          onChange={setPhotoMediaId}
        />
        {/* Without a photo: a drawn avatar someone chose for them, else initials. */}
        <FormCell
          label="Avatar"
          htmlFor="member-avatar"
          hint={photoMediaId ? 'Shown only when there is no photo.' : undefined}
        >
          <div className="flex items-center gap-3">
            {avatarSeed ? (
              <img src={avatarUrl(avatarSeed)} alt="" className="size-10 shrink-0 rounded-full" />
            ) : (
              <span
                aria-hidden
                className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-medium"
              >
                {initialsOf(name || '?')}
              </span>
            )}
            <Button
              id="member-avatar"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickingAvatar(true)}
            >
              {avatarSeed ? 'Change avatar' : 'Choose an avatar'}
            </Button>
            {avatarSeed && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarSeed(null)}>
                Remove
              </Button>
            )}
          </div>
          <AvatarPicker
            open={pickingAvatar}
            onOpenChange={setPickingAvatar}
            current={avatarSeed}
            onPick={setAvatarSeed}
            title={name ? `Choose an avatar for ${name}` : 'Choose an avatar'}
          />
        </FormCell>
      </FormSection>
      <FormSection>
        <FormCell label="Bio" htmlFor="member-bio">
          <Textarea
            id="member-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short introduction, shown on the website."
          />
        </FormCell>
        <FormSwitchCell
          id="member-published"
          label="Published"
          description="Show this person on the website."
          checked={published}
          onCheckedChange={setPublished}
        />
      </FormSection>
      {footer(pending, member === null, feedback.showSaved)}
    </form>
  );
}
