import { can } from '@ll/content';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  FileTextIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PencilIcon,
  PencilLineIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchXIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from '@/components/icons';
import { type KeyboardEvent, useEffect, useState } from 'react';
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
import { ListRows, isDesktop } from '@/components/list/list-page';
import { ListRow } from '@/components/list/list-row';
import { SearchInput, useSelection } from '@/components/list/list-tools';
import { PageActions } from '@/components/shell/page-actions';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  POSTS_PAGE_SIZE,
  type PostListData,
  type PostListRow,
  type PostStatusTab,
  deletePosts,
  requestReview,
  restorePosts,
  trashPosts,
} from '@/server/posts';
import { PostArticle } from './post-article';
import { PostStatusBadge } from './post-status-badge';
import { ReviewerPopover } from './reviewer-popover';
import { clearPostPreviews, loadPostPreview, usePostPreview } from './use-post-preview';

export type PostListSearch = {
  status: PostStatusTab;
  q?: string;
  category?: string;
  page?: number;
  selected?: string;
};

const tabs: { value: PostStatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Drafts' },
  { value: 'review', label: 'In review' },
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
  const selection = useSelection(data.rows.map((r) => r.id));
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [query, setQuery] = useState(search.q ?? '');
  const inTrash = search.status === 'trash';
  const canPurge = can(user.role, 'content:purge');
  const canWrite = can(user.role, 'posts:write');
  const canPublish = can(user.role, 'posts:publish');

  // The previewed post: the one in the URL, else the first row.
  const selectedId =
    data.rows.find((r) => r.id === search.selected)?.id ?? data.rows[0]?.id ?? null;
  const select = (id: string) =>
    navigate({ search: (prev) => ({ ...prev, selected: id }), replace: true });

  // A new page of rows starts with nothing ticked.
  useEffect(() => selection.clear(), [data.rows]);

  // Debounced search: update the URL once typing pauses.
  useEffect(() => {
    if (query === (search.q ?? '')) return;
    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({
          ...prev,
          q: query || undefined,
          page: undefined,
          selected: undefined,
        }),
        replace: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search.q, navigate]);

  const count = (n: number) => `${n} ${plural(n)}`;
  const trash = async (ids: string[]) => {
    clearPostPreviews();
    await run(() => trashPosts({ data: { ids } }), {
      success: (r) => ({
        title: `${count(r.count)} moved to the trash`,
        description:
          r.count === 1
            ? 'It waits in the trash as a draft and is not on the website.'
            : 'They wait in the trash as drafts and are not on the website.',
        action: { label: 'Undo', onClick: () => void restore(ids) },
      }),
      error: 'Could not move to the trash',
    });
  };
  const restore = async (ids: string[]) => {
    clearPostPreviews();
    await run(() => restorePosts({ data: { ids } }), {
      success: (r) => ({
        title: `${count(r.count)} restored`,
        description: 'They are drafts. Publish them when they are ready to go live.',
      }),
      error: 'Could not restore',
    });
  };
  const purge = async (ids: string[]) => {
    clearPostPreviews();
    await run(() => deletePosts({ data: { ids } }), {
      success: (r) => ({
        title: `${count(r.count)} deleted`,
        description: 'Deleted permanently, with their revisions.',
      }),
      error: 'Could not delete',
    });
    setConfirmDelete(null);
  };
  const submitReview = async (id: string, reviewerId: string | null) => {
    const result = await run(() => requestReview({ data: { id, reviewerId } }), {
      success: {
        title: 'Sent for review',
        description: reviewerId
          ? 'The reviewer was notified.'
          : 'Anyone who can publish was notified.',
      },
      error: 'Could not send for review',
    });
    return Boolean(result);
  };

  const categoryItems = [
    { value: 'all', label: 'All categories' },
    ...data.categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const page = search.page ?? 1;
  const from = data.total === 0 ? 0 : (page - 1) * POSTS_PAGE_SIZE + 1;
  const to = Math.min(page * POSTS_PAGE_SIZE, data.total);
  const checkedIds = selection.checkedIds;
  const selectedRow = data.rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Posts
        </h1>
        <SearchInput
          label="Search posts by title"
          placeholder="Filter by title"
          value={query}
          onChange={setQuery}
        />
        <Select
          items={categoryItems}
          value={search.category ?? 'all'}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                category: value === 'all' || !value ? undefined : String(value),
                page: undefined,
                selected: undefined,
              }),
            })
          }
        >
          <SelectTrigger
            aria-label="Filter by category"
            size="sm"
            className="bg-muted/60 text-ui w-40 border-0 shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="text-ui">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canWrite && (
          <Button
            size="sm"
            className="max-md:hidden"
            render={<Link to="/posts/new" />}
            nativeButton={false}
          >
            <PlusIcon aria-hidden data-icon="inline-start" />
            New post
          </Button>
        )}
        <PageActions
          edit={
            canPublish
              ? {
                  editing: selection.selecting,
                  onToggle: selection.selecting ? selection.clear : selection.startEditing,
                }
              : undefined
          }
          add={
            canWrite
              ? { label: 'New post', onClick: () => navigate({ to: '/posts/new' }) }
              : undefined
          }
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0 lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)]">
        <section aria-label="Post list" className="flex min-h-0 flex-col lg:border-r">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b px-2 max-md:mb-2 max-md:border-0 max-md:px-0">
            {checkedIds.length > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear selection"
                  onClick={selection.clear}
                >
                  <XIcon aria-hidden />
                </Button>
                <span className="text-ui mr-auto">{checkedIds.length} selected</span>
                {inTrash ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => restore(checkedIds)}
                    >
                      <RotateCcwIcon aria-hidden data-icon="inline-start" />
                      Restore
                    </Button>
                    {canPurge && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() => setConfirmDelete(checkedIds)}
                      >
                        Delete permanently
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => trash(checkedIds)}
                  >
                    <Trash2Icon aria-hidden data-icon="inline-start" />
                    Move to trash
                  </Button>
                )}
              </>
            ) : (
              <nav aria-label="Post status" className="no-scrollbar flex gap-0.5 overflow-x-auto">
                {tabs.map((tab) => {
                  const active = tab.value === search.status;
                  return (
                    <Link
                      key={tab.value}
                      to="/posts"
                      search={(prev) => ({
                        ...prev,
                        status: tab.value,
                        page: undefined,
                        selected: undefined,
                      })}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-muted-foreground hover:text-foreground text-ui flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 whitespace-nowrap transition-colors',
                        active && 'bg-muted text-foreground font-medium'
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
            )}
            {canPublish && checkedIds.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                // Phones have Edit in the top bar; touch tablets keep it here.
                className="text-tint touch:inline-flex ml-auto hidden min-h-11 shrink-0 text-[0.9375rem] font-medium max-md:hidden!"
                onClick={selection.selecting ? selection.clear : selection.startEditing}
              >
                {selection.selecting ? 'Done' : 'Edit'}
              </Button>
            )}
          </div>

          {data.rows.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <ListRows>
              {data.rows.map((row) => (
                <PostListItem
                  key={row.id}
                  row={row}
                  inTrash={inTrash}
                  selected={row.id === selectedId}
                  select={
                    canPublish
                      ? {
                          label: `Select ${row.title || 'Untitled'}`,
                          checked: selection.isChecked(row.id),
                          selecting: selection.selecting,
                          onToggle: () => selection.toggle(row.id),
                        }
                      : undefined
                  }
                  swipe={
                    inTrash
                      ? canPurge
                        ? { label: 'Delete', onAction: () => setConfirmDelete([row.id]) }
                        : undefined
                      : canPublish
                        ? { label: 'Trash', onAction: () => trash([row.id]) }
                        : undefined
                  }
                  onSelect={() => select(row.id)}
                />
              ))}
            </ListRows>
          )}

          {data.total > 0 && (
            <div className="text-muted-foreground flex h-10 shrink-0 items-center justify-between border-t px-3 text-xs max-md:border-0">
              <span className="tabular-nums">
                {from}-{to} of {data.total}
              </span>
              {data.pageCount > 1 && (
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() =>
                      navigate({
                        search: (prev) => ({
                          ...prev,
                          page: page - 1 > 1 ? page - 1 : undefined,
                          selected: undefined,
                        }),
                      })
                    }
                  >
                    <ChevronLeftIcon aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Next page"
                    disabled={page >= data.pageCount}
                    onClick={() =>
                      navigate({
                        search: (prev) => ({ ...prev, page: page + 1, selected: undefined }),
                      })
                    }
                  >
                    <ChevronRightIcon aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <PreviewPane
          row={selectedRow}
          inTrash={inTrash}
          canPurge={canPurge}
          canPublish={canPublish}
          canRequestReview={canWrite && !canPublish}
          userId={user.id}
          reviewers={data.reviewers}
          editLabel={canWrite ? 'Edit' : 'Open'}
          pending={pending}
          onTrash={(id) => trash([id])}
          onRestore={(id) => restore([id])}
          onDelete={(id) => setConfirmDelete([id])}
          onRequestReview={submitReview}
        />
      </div>

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

/** Moves focus (and selection) to the neighbouring row with the arrow keys. */
function onRowKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const item = event.currentTarget.closest('li');
  const next = event.key === 'ArrowDown' ? item?.nextElementSibling : item?.previousElementSibling;
  const button = next?.querySelector<HTMLButtonElement>('button[data-row]');
  button?.focus();
  button?.click();
}

function PostListItem({
  row,
  inTrash,
  selected,
  select,
  swipe,
  onSelect,
}: {
  row: PostListRow;
  inTrash: boolean;
  selected: boolean;
  /** Only people who may trash or restore get tick boxes. */
  select?: React.ComponentProps<typeof ListRow>['select'];
  swipe?: React.ComponentProps<typeof ListRow>['swipe'];
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const timeZone = useTimeZone();
  const date = inTrash
    ? row.deletedAt
    : row.status === 'published'
      ? row.publishedAt
      : (row.scheduledAt ?? row.updatedAt);
  const meta = [row.categories.map((c) => c.name).join(', '), row.author].filter(Boolean);

  const open = () =>
    inTrash ? undefined : navigate({ to: '/posts/$postId', params: { postId: row.id } });

  return (
    <ListRow
      align="start"
      current={selected}
      select={select}
      swipe={swipe}
      // Below lg there is no preview pane: a tap opens the editor instead.
      onOpen={() => (isDesktop() ? onSelect() : open())}
      onDoubleClick={open}
      buttonProps={{
        'data-row': true,
        onKeyDown: onRowKeyDown,
        onPointerEnter: () => void loadPostPreview(row.id),
      }}
    >
      <span className="flex items-baseline gap-3">
        <span className="text-ui min-w-0 flex-1 truncate font-medium">
          {row.title || 'Untitled'}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {date ? formatDate(date, timeZone) : ''}
        </span>
      </span>
      <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
        <PostStatusBadge
          status={row.status}
          hasDraft={row.hasDraft}
          trashed={inTrash}
          inReview={row.reviewRequestedAt !== null}
          scheduledAt={row.scheduledAt}
        />
        {meta.length > 0 && <span className="min-w-0 truncate">{['', ...meta].join(' · ')}</span>}
      </span>
    </ListRow>
  );
}

function PreviewPane({
  row,
  inTrash,
  canPurge,
  canPublish,
  canRequestReview,
  userId,
  reviewers,
  editLabel,
  pending,
  onTrash,
  onRestore,
  onDelete,
  onRequestReview,
}: {
  row: PostListRow | null;
  inTrash: boolean;
  canPurge: boolean;
  canPublish: boolean;
  canRequestReview: boolean;
  userId: string;
  reviewers: { id: string; name: string }[];
  editLabel: string;
  pending: boolean;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRequestReview: (id: string, reviewerId: string | null) => Promise<boolean>;
}) {
  const { post, error, loading } = usePostPreview(row?.id ?? null);

  if (!row) {
    return (
      <section aria-label="Preview" className="hidden lg:flex">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PanelRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No post selected</EmptyTitle>
            <EmptyDescription>Choose a post from the list to preview it here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  const offerReview =
    !inTrash &&
    canRequestReview &&
    row.createdBy === userId &&
    row.status === 'draft' &&
    !row.reviewRequestedAt;

  return (
    <section aria-label="Preview" className="hidden min-h-0 flex-col lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-muted-foreground mr-auto truncate text-xs">
          {inTrash
            ? `Trashed ${formatRelative(row.deletedAt ?? row.updatedAt)}`
            : row.reviewRequestedAt
              ? 'Submitted for review'
              : `Edited ${formatRelative(row.updatedAt)}`}
        </span>
        {offerReview && (
          <ReviewerPopover
            reviewers={reviewers}
            disabled={pending}
            size="sm"
            onSubmit={(reviewerId) => onRequestReview(row.id, reviewerId)}
          />
        )}
        {inTrash ? (
          canPublish && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => onRestore(row.id)}>
              <RotateCcwIcon aria-hidden data-icon="inline-start" />
              Restore
            </Button>
          )
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open preview in a new tab"
              render={<a href={`/preview/posts/${row.id}`} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLinkIcon aria-hidden />
            </Button>
            <Button
              size="sm"
              render={<Link to="/posts/$postId" params={{ postId: row.id }} />}
              nativeButton={false}
            >
              <PencilIcon aria-hidden data-icon="inline-start" />
              {editLabel}
            </Button>
          </>
        )}
        {(inTrash ? canPurge : canPublish) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
            >
              <MoreHorizontalIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {inTrash ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => onDelete(row.id)}
                >
                  <Trash2Icon aria-hidden />
                  Delete permanently
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    render={<Link to="/posts/$postId" params={{ postId: row.id }} />}
                  >
                    <PencilIcon aria-hidden />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={pending}
                    onClick={() => onTrash(row.id)}
                  >
                    <Trash2Icon aria-hidden />
                    Move to trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleAlertIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Could not load this post</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : loading || !post ? (
          <div className="mx-auto max-w-xl space-y-4 px-8 py-10">
            <div className="bg-muted h-7 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
            <div className="bg-muted/60 h-40 animate-pulse rounded" />
          </div>
        ) : (
          <PostArticle post={post} size="pane" />
        )}
      </div>
    </section>
  );
}

const emptyStates = {
  all: {
    icon: FileTextIcon,
    title: 'No posts yet',
    description: 'Write your first post and it will appear here.',
  },
  published: {
    icon: SendIcon,
    title: 'Nothing published yet',
    description: 'Published posts appear here once they are live on the website.',
  },
  scheduled: {
    icon: CalendarClockIcon,
    title: 'Nothing scheduled',
    description: 'Schedule a draft from the editor and it publishes itself on time.',
  },
  draft: {
    icon: PencilLineIcon,
    title: 'No drafts',
    description: 'Posts you save without publishing appear here.',
  },
  review: {
    icon: SendIcon,
    title: 'Nothing to review',
    description: 'Posts authors submit for review appear here, ready to publish.',
  },
  trash: {
    icon: Trash2Icon,
    title: 'The trash is empty',
    description: 'Posts you move to the trash stay here until they are deleted.',
  },
} satisfies Record<PostStatusTab, { icon: LucideIcon; title: string; description: string }>;

function EmptyState({ search }: { search: PostListSearch }) {
  const filtered = Boolean(search.q || search.category);
  const {
    icon: Icon,
    title,
    description,
  } = filtered
    ? {
        icon: SearchXIcon,
        title: 'No matching posts',
        description: 'Try a different title or category, or clear the filters.',
      }
    : emptyStates[search.status];

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {(filtered || search.status !== 'trash') && (
        <EmptyContent>
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
            <Button size="sm" render={<Link to="/posts/new" />} nativeButton={false}>
              <PlusIcon aria-hidden data-icon="inline-start" />
              New post
            </Button>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}
