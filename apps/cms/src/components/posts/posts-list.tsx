import { can } from '@llf/content';
import { Link, useNavigate } from '@tanstack/react-router';
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type PostListData,
  type PostListRow,
  type PostStatusTab,
  deletePosts,
  restorePosts,
  trashPosts,
} from '@/server/posts';
import { PostStatusBadge } from './post-status-badge';

export type PostListSearch = {
  status: PostStatusTab;
  q?: string;
  category?: string;
  page?: number;
};

const tabs: { value: PostStatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'trash', label: 'Trash' },
];

const plural = (n: number) => (n === 1 ? 'post' : 'posts');

export function PostsList({
  data,
  search,
  user,
}: {
  data: PostListData;
  search: PostListSearch;
  user: SessionUser;
}) {
  const navigate = useNavigate({ from: '/posts/' });
  const { run, pending } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [query, setQuery] = useState(search.q ?? '');
  const inTrash = search.status === 'trash';
  const canPurge = can(user.role, 'content:purge');

  // Selection only applies to the rows on screen.
  useEffect(() => setSelected(new Set()), [data.rows]);

  // Debounced search: update the URL once typing pauses.
  useEffect(() => {
    if (query === (search.q ?? '')) return;
    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: query || undefined, page: undefined }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search.q, navigate]);

  const allSelected = data.rows.length > 0 && selected.size === data.rows.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(data.rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const trash = (ids: string[]) =>
    run(
      () => trashPosts({ data: { ids } }),
      (r) => `${r.count} ${plural(r.count)} moved to the trash.`
    );
  const restore = (ids: string[]) =>
    run(
      () => restorePosts({ data: { ids } }),
      (r) => `${r.count} ${plural(r.count)} restored as drafts.`
    );
  const purge = async (ids: string[]) => {
    await run(
      () => deletePosts({ data: { ids } }),
      (r) => `${r.count} ${plural(r.count)} permanently deleted.`
    );
    setConfirmDelete(null);
  };

  const categoryItems = [
    { value: 'all', label: 'All categories' },
    ...data.categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const ids = [...selected];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl">Posts</h1>
        <Button render={<Link to="/posts/new" />} nativeButton={false}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          New post
        </Button>
      </div>

      <nav aria-label="Post status" className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const active = tab.value === search.status;
          return (
            <Link
              key={tab.value}
              to="/posts"
              search={(prev) => ({ ...prev, status: tab.value, page: undefined })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground -mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2 text-sm transition-colors',
                active ? 'border-foreground text-foreground font-medium' : 'border-transparent'
              )}
            >
              {tab.label}
              <span className="text-muted-foreground text-xs tabular-nums">
                {data.counts[tab.value]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            aria-label="Search posts by title"
            placeholder="Search posts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          items={categoryItems}
          value={search.category ?? 'all'}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                category: value === 'all' || !value ? undefined : String(value),
                page: undefined,
              }),
            })
          }
        >
          <SelectTrigger aria-label="Filter by category" className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-muted-foreground text-sm">{selected.size} selected</span>
            {inTrash ? (
              <>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => restore(ids)}>
                  Restore
                </Button>
                {canPurge && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirmDelete(ids)}
                  >
                    Delete permanently
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => trash(ids)}>
                Move to trash
              </Button>
            )}
          </div>
        )}
      </div>

      {data.rows.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <div className="ring-border overflow-hidden rounded-lg ring-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    aria-label="Select all posts on this page"
                    checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Author</TableHead>
                <TableHead className="hidden lg:table-cell">Categories</TableHead>
                <TableHead className="hidden xl:table-cell">Tags</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <PostRow
                  key={row.id}
                  row={row}
                  selected={selected.has(row.id)}
                  onToggle={() => toggle(row.id)}
                  inTrash={inTrash}
                  canPurge={canPurge}
                  pending={pending}
                  onTrash={() => trash([row.id])}
                  onRestore={() => restore([row.id])}
                  onDelete={() => setConfirmDelete([row.id])}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data.pageCount > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            Page {search.page ?? 1} of {data.pageCount} · {data.total} {plural(data.total)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(search.page ?? 1) <= 1}
              onClick={() =>
                navigate({
                  search: (prev) => ({ ...prev, page: (prev.page ?? 1) - 1 || undefined }),
                })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(search.page ?? 1) >= data.pageCount}
              onClick={() =>
                navigate({ search: (prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.length ?? 0} {plural(confirmDelete?.length ?? 0)} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This also deletes their revision history. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => confirmDelete && purge(confirmDelete)}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostRow({
  row,
  selected,
  onToggle,
  inTrash,
  canPurge,
  pending,
  onTrash,
  onRestore,
  onDelete,
}: {
  row: PostListRow;
  selected: boolean;
  onToggle: () => void;
  inTrash: boolean;
  canPurge: boolean;
  pending: boolean;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const date = inTrash
    ? { label: 'Trashed', at: row.deletedAt }
    : row.status === 'published'
      ? { label: 'Published', at: row.publishedAt }
      : { label: 'Last edited', at: row.updatedAt };

  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      <TableCell className="pl-3">
        <Checkbox
          aria-label={`Select ${row.title}`}
          checked={selected}
          onCheckedChange={onToggle}
        />
      </TableCell>
      <TableCell className="max-w-0 min-w-48 whitespace-normal">
        <div className="flex flex-col gap-1">
          {inTrash ? (
            <span className="text-muted-foreground font-medium">{row.title || 'Untitled'}</span>
          ) : (
            <Link
              to="/posts/$postId"
              params={{ postId: row.id }}
              className="font-medium hover:underline"
            >
              {row.title || 'Untitled'}
            </Link>
          )}
          <PostStatusBadge status={row.status} hasDraft={row.hasDraft} trashed={inTrash} />
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">
        {row.author ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 truncate lg:table-cell">
        {row.categories.map((c) => c.name).join(', ') || '—'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-48 truncate xl:table-cell">
        {row.tags.map((t) => t.name).join(', ') || '—'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden sm:table-cell">
        <span className="block text-xs">{date.label}</span>
        {date.at ? formatDate(date.at) : '—'}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.title}`} />
            }
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {inTrash ? (
              <>
                <DropdownMenuItem disabled={pending} onClick={onRestore}>
                  Restore
                </DropdownMenuItem>
                {canPurge && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" disabled={pending} onClick={onDelete}>
                      Delete permanently
                    </DropdownMenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem render={<Link to="/posts/$postId" params={{ postId: row.id }} />}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={pending} onClick={onTrash}>
                  Move to trash
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ search }: { search: PostListSearch }) {
  const filtered = Boolean(search.q || search.category);
  const message = filtered
    ? 'No posts match these filters.'
    : search.status === 'trash'
      ? 'The trash is empty.'
      : search.status === 'draft'
        ? 'No drafts.'
        : search.status === 'published'
          ? 'Nothing published yet.'
          : 'No posts yet.';

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      {filtered ? (
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/posts" search={{ status: search.status }} />}
          nativeButton={false}
        >
          Clear filters
        </Button>
      ) : (
        search.status !== 'trash' && (
          <Button size="sm" render={<Link to="/posts/new" />} nativeButton={false}>
            Write a post
          </Button>
        )
      )}
    </div>
  );
}
