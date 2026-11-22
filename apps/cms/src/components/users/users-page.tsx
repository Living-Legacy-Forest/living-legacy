import { type Permission, type Role } from '@ll/content';
import { CameraIcon, Trash2Icon, UserPlusIcon } from '@/components/icons';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExtraAccess } from '@/components/users/extra-access';
import {
  extrasLine,
  invitePayload,
  normaliseExtras,
  resendPayload,
} from '@/components/users/extra-access-rules';
import { UserPhotoDialog } from '@/components/users/user-photo-dialog';
import { FormCell, FormSection, groupBoxClass, groupHeadingClass } from '@/components/form-cells';
import { DialogActions, ListDialog } from '@/components/list/list-page';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageActions } from '@/components/shell/page-actions';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRelative } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type TeamData,
  changeUserRole,
  inviteUser,
  removeUser,
  revokeInvitation,
  setExtraPermissions,
} from '@/server/users';
import { avatarSrc } from '@/lib/avatar';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

const roleItems = [
  { value: 'editor', label: 'Editor', description: 'Write and publish all content.' },
  { value: 'author', label: 'Author', description: 'Write posts and submit them for review.' },
  { value: 'seo', label: 'SEO', description: 'Search listings, redirects and search settings.' },
  { value: 'viewer', label: 'Viewer', description: 'Read only. Sees content, changes nothing.' },
  { value: 'admin', label: 'Admin', description: 'Full access, plus users and settings.' },
];

const tableCellPadding = '[&_td]:px-4 [&_th]:px-4';

type TeamUser = TeamData['users'][number];

function initials(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('') || '?'
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5 max-md:space-y-1.5">
      <div className={cn('flex items-baseline gap-2', groupHeadingClass)}>
        <h2 className="text-sm font-medium max-md:text-[0.8125rem] max-md:font-normal">{title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums max-md:text-[0.8125rem]">
          {count}
        </span>
      </div>
      <div className={groupBoxClass}>{children}</div>
    </section>
  );
}

export function UsersPage({ data }: { data: TeamData }) {
  const [inviting, setInviting] = useState(false);
  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-3xl space-y-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            <RevealWords text="Users" />
          </h1>
          <p className="text-muted-foreground text-sm">People who can sign in to the CMS.</p>
        </div>
        <Button size="sm" className="max-md:hidden" onClick={() => setInviting(true)}>
          <UserPlusIcon aria-hidden data-icon="inline-start" />
          Invite
        </Button>
        <PageActions add={{ label: 'Invite someone', onClick: () => setInviting(true) }} />
        <InviteDialog open={inviting} onOpenChange={setInviting} />
      </div>

      <Section title="Members" count={data.users.length}>
        <UsersTable data={data} />
      </Section>

      {data.invitations.length > 0 && (
        <Section title="Pending invitations" count={data.invitations.length}>
          <InvitationsTable invitations={data.invitations} />
        </Section>
      )}
    </div>
  );
}

function UsersTable({ data }: { data: TeamData }) {
  const { run, pending } = useAction();
  // The person stays set after the sheet closes so it slides away with its content; the key gives
  // each opening a fresh form, so edits that were not saved do not come back.
  const [accessFor, setAccessFor] = useState<TeamUser | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessKey, setAccessKey] = useState(0);
  function openAccess(u: TeamUser) {
    setAccessFor(u);
    setAccessKey((k) => k + 1);
    setAccessOpen(true);
  }

  function changeRole(u: TeamUser, value: string) {
    if (value === u.role) return;
    run(() => changeUserRole({ data: { userId: u.id, role: value as Role } }), {
      success: {
        title: 'Role changed',
        description: `${u.name || u.email} is now ${roleLabel(value)}.`,
      },
      error: 'Could not change the role',
    });
  }

  return (
    <>
      <Table className={tableCellPadding}>
        <TableHeader className="max-sm:hidden">
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="w-36 max-sm:hidden">Role</TableHead>
            <TableHead className="w-32 max-md:hidden">Last active</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.users.map((u) => {
            const isSelf = u.id === data.currentUserId;
            const isLastAdmin = u.role === 'admin' && data.adminCount === 1;
            // You can't demote or remove yourself, or the only admin; show the
            // role as text rather than a control that does nothing. A super admin is shown as
            // one and left as text too: it comes from BOOTSTRAP_ADMIN_EMAILS, not from the role.
            const locked = isSelf || isLastAdmin || u.isSuperAdmin;
            // Only a super admin can remove anyone.
            const canRemove = data.viewerIsSuperAdmin && !isSelf && !isLastAdmin;
            const role = (
              <RoleControl
                user={u}
                locked={locked}
                note={isLastAdmin && !isSelf && !u.isSuperAdmin ? 'Only admin' : undefined}
                disabled={pending}
                onChange={(value) => changeRole(u, value)}
              />
            );
            return (
              <TableRow key={u.id}>
                <TableCell className="w-full max-w-0 py-3">
                  <div className="flex items-center gap-3 max-sm:items-start">
                    <UserAvatar user={u} isSelf={isSelf} />
                    <div className="min-w-0 flex-1">
                      {/* Wraps so the badges drop under a long name instead of squeezing it. */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                        <span className="max-w-full truncate">{u.name || u.email}</span>
                        {isSelf && <Badge variant="secondary">You</Badge>}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                      {/* Phones have no room for the role and activity columns. */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
                        {role}
                        <LastActive at={u.lastActiveAt} className="text-xs" />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-sm:hidden">{role}</TableCell>
                <TableCell className="max-md:hidden">
                  <LastActive at={u.lastActiveAt} className="text-sm" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="touch:min-h-11"
                      aria-label={`Access for ${u.name || u.email}`}
                      onClick={() => openAccess(u)}
                    >
                      Access
                    </Button>
                    {/* Keeps Access in line on rows that cannot be removed. */}
                    {!canRemove && data.viewerIsSuperAdmin && (
                      <span aria-hidden className="touch:size-9 size-8 shrink-0" />
                    )}
                    {canRemove && (
                      <RemoveUser
                        user={u}
                        onConfirm={() =>
                          run(() => removeUser({ data: { userId: u.id } }), {
                            success: {
                              title: 'User removed',
                              description: `${u.name || u.email} is signed out and can no longer sign in.`,
                            },
                            error: 'Could not remove the user',
                          })
                        }
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <AccessDialog
        user={accessFor}
        open={accessOpen}
        formKey={accessKey}
        isSelf={accessFor?.id === data.currentUserId}
        onClose={() => setAccessOpen(false)}
      />
    </>
  );
}

function roleLabel(value: string) {
  return roleItems.find((r) => r.value === value)?.label ?? value;
}

/** What to call a person's role: a super admin is named as one, not as a plain Admin. */
function roleName(user: { role: string; isSuperAdmin: boolean }) {
  return user.isSuperAdmin ? 'Super admin' : roleLabel(user.role);
}

/** The role picker, with what each role can do; plain text where it can't change. */
function RoleControl({
  user,
  locked,
  note,
  disabled,
  onChange,
}: {
  user: TeamUser;
  locked: boolean;
  note?: string;
  disabled: boolean;
  onChange: (role: string) => void;
}) {
  if (locked) {
    return (
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        {roleName(user)}
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </span>
    );
  }
  return (
    <Select
      items={roleItems}
      value={user.role}
      disabled={disabled}
      onValueChange={(value) => value && onChange(value)}
    >
      <SelectTrigger size="sm" aria-label={`Role for ${user.name || user.email}`} className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="w-auto max-w-80">
        {roleItems.map((item) => (
          <SelectItem key={item.value} value={item.value} className="items-start py-2">
            <div className="grid gap-0.5 pr-4">
              <span className="text-ui font-medium">{item.label}</span>
              <span className="text-muted-foreground text-xs">{item.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A person's extra access, on top of their role. Your own is read-only. A sheet from the right on
 * wider screens, so the list of people stays beside it; phones get the usual bottom sheet.
 */
function AccessDialog({
  user,
  open,
  formKey,
  isSelf,
  onClose,
}: {
  user: TeamUser | null;
  open: boolean;
  /** Changes with each opening, so the form starts again from what is saved. */
  formKey: number;
  isSelf: boolean;
  onClose: () => void;
}) {
  const isPhone = useIsMobile();
  const description = user
    ? user.role === 'admin'
      ? `${user.name || user.email} is ${roleName(user)}.`
      : `${user.name || user.email} is ${roleName(user)}. Anything you add here is on top of that.`
    : undefined;

  if (isPhone) {
    return (
      <ListDialog
        open={open && user !== null}
        onClose={onClose}
        title="Access"
        description={description}
      >
        {user && (
          <AccessForm key={formKey} user={user} isSelf={isSelf} layout="phone" onDone={onClose} />
        )}
      </ListDialog>
    );
  }

  return (
    <Sheet open={open && user !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg">Access</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {user && (
          <AccessForm key={formKey} user={user} isSelf={isSelf} layout="sheet" onDone={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AccessForm({
  user,
  isSelf,
  layout,
  onDone,
}: {
  user: TeamUser;
  isSelf: boolean;
  /** The sheet pins Cancel and Save under a scrolling list; a phone's bar holds Save. */
  layout: 'sheet' | 'phone';
  onDone: () => void;
}) {
  const [extras, setExtras] = useState<Permission[]>(user.extraPermissions);
  const { run, pending } = useAction();
  const readOnly = isSelf || user.role === 'admin';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Closes only when the save worked: the function returns nothing, so `run`'s result
    // cannot tell success from failure.
    await run(
      () =>
        setExtraPermissions({
          data: { userId: user.id, extraPermissions: normaliseExtras(user.role, extras) },
        }),
      {
        success: {
          title: 'Access saved',
          description:
            'It can take up to five minutes to reach someone who is signed in. They may need to reload the CMS to see new pages.',
        },
        error: 'Could not save access',
        afterAction: onDone,
      }
    );
  }

  const saveButton = (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : (
        'Save access'
      )}
    </Button>
  );
  const fields = (
    <>
      {isSelf && user.role !== 'admin' && (
        <p className="text-muted-foreground text-sm">You cannot change your own access.</p>
      )}
      <ExtraAccess
        role={user.role}
        value={extras}
        onChange={setExtras}
        disabled={readOnly || pending}
      />
    </>
  );

  if (layout === 'sheet') {
    // The list scrolls and the buttons stay in view under it, so a long list never hides Save.
    return (
      <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">{fields}</div>
        <SheetFooter className="mt-0 flex-row items-center justify-end border-t">
          <SheetClose render={<Button type="button" variant="outline" />}>
            {readOnly ? 'Close' : 'Cancel'}
          </SheetClose>
          {!readOnly && saveButton}
        </SheetFooter>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5 max-md:space-y-7">
      {fields}
      {!readOnly && <DialogActions>{saveButton}</DialogActions>}
    </form>
  );
}

function LastActive({ at, className }: { at: number | null; className?: string }) {
  return (
    <span className={cn('text-muted-foreground', className)}>
      {at === null ? 'No recent sign-in' : `Active ${formatRelative(at)}`}
    </span>
  );
}

function UserAvatar({ user, isSelf }: { user: TeamUser; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const label = user.name || user.email;
  return (
    <>
      <button
        type="button"
        aria-label={`Change ${label}'s photo`}
        onClick={() => setOpen(true)}
        className="group focus-visible:ring-ring relative shrink-0 rounded-full outline-none focus-visible:ring-2"
      >
        <Avatar className="size-9">
          {avatarSrc(user) && <AvatarImage src={avatarSrc(user)} alt={user.imageAlt ?? ''} />}
          <AvatarFallback className="bg-muted text-xs font-medium">
            {initials(label)}
          </AvatarFallback>
        </Avatar>
        <span className="bg-background/85 touch:hidden absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
          <CameraIcon aria-hidden className="size-3.5" />
        </span>
        {/* Touch screens can't hover, so the camera shows as a badge instead. */}
        <span className="bg-background touch:flex absolute -right-1 -bottom-1 hidden size-5 items-center justify-center rounded-full border">
          <CameraIcon aria-hidden className="size-3" />
        </span>
      </button>
      <UserPhotoDialog
        user={user}
        isSelf={isSelf}
        initials={initials(label)}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function RemoveUser({ user, onConfirm }: { user: TeamUser; onConfirm: () => void }) {
  const label = user.name || user.email;
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${label}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to the CMS immediately. This cannot be undone.
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

function InviteDialog({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [extras, setExtras] = useState<Permission[]>([]);
  const { run, pending } = useAction();
  const isPhone = useIsMobile();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => inviteUser({ data: invitePayload(email, role, extras) }), {
      success: (r) =>
        r.emailed
          ? { title: 'Invite sent', description: `${r.email} can sign in from the email.` }
          : {
              title: 'Invited, but the email failed',
              description: `${r.email} can still sign in from the login page.`,
            },
      error: 'Could not send the invite',
    });
    if (result) {
      setOpen(false);
      setEmail('');
      setRole('editor');
      setExtras([]);
    }
  }

  const description =
    'They get an email with a link to sign in. You can change their role and access later.';

  const sendButton = (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Sending…
        </>
      ) : (
        'Send invite'
      )}
    </Button>
  );
  const fields = (
    <>
      <FormSection>
        <FormCell label="Email" htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </FormCell>
      </FormSection>
      <div className="space-y-2 max-md:space-y-1.5">
        <Label className={groupHeadingClass}>Role</Label>
        <FormSection>
          <div className="grid grid-cols-2 gap-2">
            {roleItems.map((item) => {
              const selected = role === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    // Extras are picked against a role, so a new role starts with none.
                    if (item.value !== role) setExtras([]);
                    setRole(item.value as Role);
                  }}
                  className={cn(
                    'focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2',
                    selected ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">{item.description}</div>
                </button>
              );
            })}
          </div>
        </FormSection>
      </div>
      <div className="space-y-3 max-md:space-y-2">
        <Label className={groupHeadingClass}>Extra access</Label>
        <ExtraAccess role={role} value={extras} onChange={setExtras} disabled={pending} />
      </div>
    </>
  );

  if (isPhone) {
    return (
      <ListDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invite someone"
        description={description}
        icon={
          <span className="bg-muted text-foreground mb-1 flex size-10 items-center justify-center rounded-lg">
            <UserPlusIcon aria-hidden className="size-5" />
          </span>
        }
      >
        <form noValidate onSubmit={submit} className="space-y-5 max-md:space-y-7">
          {fields}
          <DialogActions>{sendButton}</DialogActions>
        </form>
      </ListDialog>
    );
  }

  // A sheet from the right on wider screens, like Access: the list of people stays beside it, and
  // the buttons stay in view under a scrolling form.
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg">Invite someone</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">{fields}</div>
          <SheetFooter className="mt-0 flex-row items-center justify-end border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
            {sendButton}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function InvitationsTable({ invitations }: { invitations: TeamData['invitations'] }) {
  const { run, pending } = useAction();

  const resend = (invite: TeamData['invitations'][number]) =>
    run(() => inviteUser({ data: resendPayload(invite) }), {
      success: (r) =>
        r.emailed
          ? { title: 'Invite sent again', description: `A new email is on its way to ${r.email}.` }
          : {
              title: 'The email failed again',
              description: `${r.email} can still sign in from the login page.`,
            },
      error: 'Could not resend the invite',
    });

  const revoke = (email: string) =>
    run(() => revokeInvitation({ data: { email } }), {
      success: {
        title: 'Invitation revoked',
        description: `${email} can no longer sign up.`,
      },
      error: 'Could not revoke the invitation',
    });

  return (
    <Table className={tableCellPadding}>
      <TableHeader className="max-sm:hidden">
        <TableRow className="hover:bg-transparent">
          <TableHead>Email</TableHead>
          <TableHead className="w-36 max-sm:hidden">Role</TableHead>
          <TableHead className="w-32 max-md:hidden">Invited</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invite) => (
          <TableRow key={invite.email}>
            <TableCell className="w-full max-w-0 py-3">
              <div className="truncate">{invite.email}</div>
              {extrasLine(invite.role, invite.extraPermissions) && (
                <div className="text-muted-foreground text-xs">
                  Extra access: {extrasLine(invite.role, invite.extraPermissions)}
                </div>
              )}
              <div className="text-muted-foreground text-xs sm:hidden">
                {roleLabel(invite.role)} · invited {formatRelative(invite.createdAt)}
              </div>
            </TableCell>
            <TableCell className="text-sm max-sm:hidden">{roleLabel(invite.role)}</TableCell>
            <TableCell className="text-muted-foreground text-sm max-md:hidden">
              {formatRelative(invite.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => resend(invite)}>
                  Resend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => revoke(invite.email)}
                >
                  Revoke
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
