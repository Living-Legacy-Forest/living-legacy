import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAction } from '@/lib/use-action';
import {
  type TeamListData,
  type TeamMember,
  deleteTeamMember,
  moveTeamMember,
  saveTeamMember,
} from '@/server/team';

export function TeamPage({ data, canWrite }: { data: TeamListData; canWrite: boolean }) {
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setOpen(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm">
            People shown on the website and chosen as post authors.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openNew}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            Add member
          </Button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
          No team members yet.
        </div>
      ) : (
        <section className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-medium">Members</h2>
            <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <TeamTable data={data} canWrite={canWrite} onEdit={openEdit} />
          </div>
        </section>
      )}

      {canWrite && (
        <MemberDialog
          key={editing?.id ?? 'new'}
          member={editing}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

function TeamTable({
  data,
  canWrite,
  onEdit,
}: {
  data: TeamListData;
  canWrite: boolean;
  onEdit: (member: TeamMember) => void;
}) {
  const { run, pending } = useAction();

  return (
    <Table className="[&_td]:px-4 [&_th]:px-4">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((member, index) => (
          <TableRow key={member.id}>
            <TableCell className="py-2.5">
              <div className="text-sm font-medium">{member.name}</div>
              {member.role && <div className="text-muted-foreground text-xs">{member.role}</div>}
            </TableCell>
            <TableCell>
              <Badge
                variant={member.status === 'published' ? 'secondary' : 'outline'}
                className="capitalize"
              >
                {member.status}
              </Badge>
            </TableCell>
            <TableCell>
              {canWrite && (
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${member.name} up`}
                    disabled={index === 0 || pending}
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
                    disabled={index === data.length - 1 || pending}
                    onClick={() =>
                      run(() => moveTeamMember({ data: { id: member.id, direction: 'down' } }))
                    }
                  >
                    <ChevronDownIcon aria-hidden className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${member.name}`}
                    onClick={() => onEdit(member)}
                  >
                    <PencilIcon aria-hidden className="size-4" />
                  </Button>
                  <DeleteMember
                    member={member}
                    onConfirm={() =>
                      run(() => deleteTeamMember({ data: { id: member.id } }), 'Member removed.')
                    }
                  />
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeleteMember({ member, onConfirm }: { member: TeamMember; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
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

function MemberDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
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
            status: published ? 'published' : 'draft',
          },
        }),
      member ? 'Member updated.' : 'Member added.'
    );
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Shown on the website and available as a post author.
          </DialogDescription>
        </DialogHeader>
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Published</div>
              <div className="text-muted-foreground text-xs">Show this person on the website.</div>
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
              ) : member ? (
                'Save'
              ) : (
                'Add member'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
