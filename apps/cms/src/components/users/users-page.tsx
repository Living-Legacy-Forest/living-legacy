import { type Role } from '@llf/content';
import { Trash2Icon, UserPlusIcon } from 'lucide-react';
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
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import {
  type TeamData,
  changeUserRole,
  inviteUser,
  removeUser,
  revokeInvitation,
} from '@/server/users';

const roleItems = [
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
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
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
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

  return (
    <Table className={tableCellPadding}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="w-32">Role</TableHead>
          <TableHead className="w-28">Joined</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.users.map((u) => {
          const isSelf = u.id === data.currentUserId;
          const isLastAdmin = u.role === 'admin' && data.adminCount === 1;
          const locked = isSelf || isLastAdmin;
          return (
            <TableRow key={u.id}>
              <TableCell className="py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    {u.image && <AvatarImage src={u.image} alt="" />}
                    <AvatarFallback className="bg-muted text-xs font-medium">
                      {initials(u.name || u.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{u.name || u.email}</span>
                      {isSelf && <Badge variant="secondary">You</Badge>}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  items={roleItems}
                  value={u.role}
                  disabled={locked || pending}
                  onValueChange={(value) => {
                    if (value && value !== u.role) {
                      run(
                        () => changeUserRole({ data: { userId: u.id, role: value as Role } }),
                        'Role updated.'
                      );
                    }
                  }}
                >
                  <SelectTrigger size="sm" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(u.createdAt)}
              </TableCell>
              <TableCell>
                <RemoveUser
                  user={u}
                  disabled={locked}
                  onConfirm={() =>
                    run(() => removeUser({ data: { userId: u.id } }), 'User removed.')
                  }
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RemoveUser({
  user,
  disabled,
  onConfirm,
}: {
  user: TeamUser;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const label = user.name || user.email;
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
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
    const result = await run(
      () => inviteUser({ data: { email, role } }),
      (r) =>
        r.emailed
          ? `Invite sent to ${r.email}.`
          : `Invited ${r.email}, but the email could not be sent.`
    );
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email with a link to sign in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
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
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              items={roleItems}
              value={role}
              onValueChange={(value) => value && setRole(value as Role)}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

  return (
    <Table className={tableCellPadding}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Email</TableHead>
          <TableHead className="w-32">Role</TableHead>
          <TableHead className="w-28">Invited</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invite) => (
          <TableRow key={invite.email}>
            <TableCell className="py-2.5 text-sm">{invite.email}</TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">
                {invite.role}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(invite.createdAt)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={pending}
                onClick={() =>
                  run(
                    () => revokeInvitation({ data: { email: invite.email } }),
                    'Invitation revoked.'
                  )
                }
              >
                Revoke
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
