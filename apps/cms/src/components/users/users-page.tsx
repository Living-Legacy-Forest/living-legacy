import { type Role } from '@ll/content';
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserPhotoDialog } from '@/components/users/user-photo-dialog';
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
} from '@/server/users';

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
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      </div>
      <div className="overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}

export function UsersPage({ data }: { data: TeamData }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            Users
          </h1>
          <p className="text-muted-foreground text-sm">People who can sign in to the CMS.</p>
        </div>
        <InviteDialog />
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
          // role as text rather than a control that does nothing.
          const locked = isSelf || isLastAdmin;
          const role = (
            <RoleControl
              user={u}
              locked={locked}
              note={isLastAdmin && !isSelf ? 'Only admin' : undefined}
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
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{u.name || u.email}</span>
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
                {!locked && (
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function roleLabel(value: string) {
  return roleItems.find((r) => r.value === value)?.label ?? value;
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
        {roleLabel(user.role)}
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
      <SelectTrigger
        size="sm"
        aria-label={`Role for ${user.name || user.email}`}
        className="text-ui w-28"
      >
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
          {user.image && <AvatarImage src={user.image} alt={user.imageAlt ?? ''} />}
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

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const { run, pending } = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => inviteUser({ data: { email, role } }), {
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlusIcon aria-hidden data-icon="inline-start" />
            Invite
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="bg-muted text-foreground mb-1 flex size-10 items-center justify-center rounded-lg">
            <UserPlusIcon aria-hidden className="size-5" />
          </span>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            They get an email with a link to sign in. You can change their role later.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2">
              {roleItems.map((item) => {
                const selected = role === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRole(item.value as Role)}
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
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvitationsTable({ invitations }: { invitations: TeamData['invitations'] }) {
  const { run, pending } = useAction();

  const resend = (invite: TeamData['invitations'][number]) =>
    run(() => inviteUser({ data: { email: invite.email, role: invite.role } }), {
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
