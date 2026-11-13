import { blogPath, can } from '@ll/content';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
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
import { ListRow, type RowMenuItem } from '@/components/list/list-row';
import { SearchInput, useSelection } from '@/components/list/list-tools';
import { ListFilter } from '@/components/list/list-filter';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
import { RowCell } from '@/components/list/row-cell';
import { TrendChart } from '@/components/list/trend-chart';
import { dummyTrend } from '@/components/list/dummy-trend';
import { PillGlide, pillItemClass, pillTrackClass } from '@/components/ui/pill-track';
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
import { formatDate, formatRelative } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import { copyLink, openInNewTab, siteUrl } from '@/lib/site';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  POSTS_PAGE_SIZE,
  type PostListData,
  type PostListRow,
  type PostStatusTab,
  deletePosts,
  duplicatePost,
  requestReview,
  restorePosts,
  trashPosts,
  unpublishPost,
} from '@/server/posts';
import { PostArticle } from './post-article';
import { PostStatusBadge } from './post-status-badge';
import { ReviewerPopover } from './reviewer-popover';
import { clearPostPreviews, loadPostPreview, usePostPreview } from './use-post-preview';

export type PostListSearch = {
  status: PostStatusTab;
  q?: string;
  categories?: string[];
  authors?: string[];
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
  const revealing = useRevealOnce();
  const selection = useSelection(data.rows.map((r) => r.id));
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [query, setQuery] = useState(search.q ?? '');
  const inTrash = search.status === 'trash';
  // The preview pane can be closed to give the list the full width; the choice is remembered.
  const [previewPref, setPreviewPref] = useState(data.previewOpen);
  // Grid or list, remembered the same way. Cards have no preview pane beside them.
  const [view, setView] = useListView('posts');
  const grid = view === 'grid';
  const previewOpen = previewPref && !grid;
  const setPreview = (open: boolean) => {
    setPreviewPref(open);
    document.cookie = `posts_preview=${open ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`;
  };
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
  const unpublish = async (id: string) => {
    clearPostPreviews();
    await run(() => unpublishPost({ data: { id } }), {
      success: {
        title: 'Post unpublished',
        description: 'It is off the website and a draft again.',
      },
      error: 'Could not unpublish',
    });
  };
  const duplicate = async (id: string) => {
    const copy = await run(() => duplicatePost({ data: { id } }), {
      success: { title: 'Post duplicated', description: 'You are now editing the copy.' },
      error: 'Could not duplicate',
    });
    if (copy) await navigate({ to: '/posts/$postId', params: { postId: copy.id } });
  };
  /** The row's context menu. Publishing needs the editor, which checks the post first. */
  const removeAction = (row: PostListRow) =>
    inTrash
      ? canPurge
        ? { label: 'Delete', onAction: () => setConfirmDelete([row.id]) }
        : undefined
      : canPublish
        ? { label: 'Trash', onAction: () => trash([row.id]) }
        : undefined;

  const rowMenu = (row: PostListRow): RowMenuItem[] => {
    if (inTrash) {
      return canPublish
        ? [
            {
              label: 'Restore',
              icon: <RotateCcwIcon aria-hidden />,
              onSelect: () => void restore([row.id]),
              shortcut: { key: 'r' },
            },
          ]
        : [];
    }
    const live = row.status === 'published' ? siteUrl(`${blogPath(row.slug)}/`) : null;
    const items: RowMenuItem[] = [];
    // On phones Open already goes to the editor.
    if (canWrite && isDesktop()) {
      items.push({
        label: 'Edit',
        icon: <PencilIcon aria-hidden />,
        onSelect: () => void navigate({ to: '/posts/$postId', params: { postId: row.id } }),
        shortcut: { key: 'e' },
      });
    }
    if (canWrite) {
      items.push({
        label: 'Duplicate',
        icon: <CopyIcon aria-hidden />,
        onSelect: () => void duplicate(row.id),
        shortcut: { key: 'd' },
      });
    }
    if (live) {
      items.push(
        {
          label: 'View on website',
          icon: <ExternalLinkIcon aria-hidden />,
          onSelect: () => openInNewTab(live),
          shortcut: { key: 'v' },
        },
        {
          label: 'Copy link',
          icon: <LinkIcon aria-hidden />,
          onSelect: () => void copyLink(live),
          shortcut: { key: 'c' },
        }
      );
      if (canPublish) {
        items.push({
          label: 'Unpublish',
          icon: <EyeOffIcon aria-hidden />,
          destructive: true,
          onSelect: () => void unpublish(row.id),
          shortcut: { key: 'u' },
        });
      }
    }
    return items;
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

  const page = search.page ?? 1;
  const from = data.total === 0 ? 0 : (page - 1) * POSTS_PAGE_SIZE + 1;
  const to = Math.min(page * POSTS_PAGE_SIZE, data.total);
  const checkedIds = selection.checkedIds;
  const selectedRow = data.rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-col gap-4 lg:h-[calc(100svh-7.5rem)]"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          <RevealWords text="Posts" />
        </h1>
        <SearchInput
          label="Search posts by title"
          placeholder="Filter by title"
          value={query}
          onChange={setQuery}
        />
        <ListFilter
          groups={[
            {
              key: 'categories',
              label: 'Category',
              options: data.categories.map((c) => ({ value: c.id, label: c.name })),
            },
            {
              key: 'authors',
              label: 'Author',
              options: data.authors.map((a) => ({ value: a.id, label: a.name })),
            },
          ]}
          values={{ categories: search.categories ?? [], authors: search.authors ?? [] }}
          onChange={(key, next) =>
            navigate({
              search: (prev) => ({
                ...prev,
                [key]: next.length ? next : undefined,
                page: undefined,
                selected: undefined,
              }),
            })
          }
          onClear={() =>
            navigate({
              search: (prev) => ({
                ...prev,
                categories: undefined,
                authors: undefined,
                page: undefined,
                selected: undefined,
              }),
            })
          }
        />
        <ViewSwitch value={view} onChange={setView} />
        {!grid && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={previewOpen ? 'Expand list' : 'Show preview'}
            aria-pressed={!previewOpen}
            title={previewOpen ? 'Expand list' : 'Show preview'}
            className="max-lg:hidden"
            onClick={() => setPreview(!previewOpen)}
          >
            <PanelRightIcon aria-hidden />
          </Button>
        )}
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
            canPublish && !grid
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

      <div
        data-slot="list-panes"
        className={cn(
          // Plain fr tracks so the columns glide between open and closed.
          'grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border max-md:flex-none max-md:overflow-visible max-md:rounded-none max-md:border-0',
          'motion-reduce:transition-none lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
          previewOpen ? 'lg:grid-cols-[2fr_3fr]' : 'lg:grid-cols-[1fr_0fr]'
        )}
      >
        <section
          aria-label="Post list"
          className={cn(
            'flex min-h-0 min-w-80 flex-col transition-[border-color] duration-300 lg:border-r',
            !previewOpen && 'border-transparent'
          )}
        >
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
              <nav
                aria-label="Post status"
                data-slot="pill-track"
                className={cn(pillTrackClass, 'no-scrollbar overflow-x-auto')}
              >
                <PillGlide value={search.status} />
                {tabs
                  // Empty tabs only crowd the row (and pushed Trash out of sight); All and the
                  // current tab always stay.
                  .filter(
                    (tab) =>
                      tab.value === 'all' ||
                      tab.value === search.status ||
                      data.counts[tab.value] > 0
                  )
                  .map((tab) => {
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
                        className={pillItemClass}
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
            {canPublish && !grid && checkedIds.length === 0 && (
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
          ) : grid ? (
            <ListCards>
              {data.rows.map((row) => (
                <PostCard
                  key={row.id}
                  row={row}
                  inTrash={inTrash}
                  // A card's Open already goes to the editor.
                  menu={rowMenu(row).filter((item) => item.label !== 'Edit')}
                  remove={removeAction(row)}
                  views={row.deletedAt ? undefined : dummyTrend(row.slug)}
                />
              ))}
            </ListCards>
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
                  swipe={removeAction(row)}
                  menu={rowMenu(row)}
                  previewOpen={previewOpen}
                  views={row.deletedAt ? undefined : dummyTrend(row.slug)}
                  onSelect={() => {
                    // Choosing the post already showing closes the preview again.
                    if (previewOpen && row.id === selectedId) return setPreview(false);
                    select(row.id);
                    setPreview(true);
                  }}
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

        <div
          inert={!previewOpen}
          className={cn(
            'hidden min-h-0 min-w-0 flex-col overflow-hidden transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:flex',
            !previewOpen && 'translate-x-4 opacity-0'
          )}
        >
          <PreviewPane
            onClose={() => setPreview(false)}
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

/** One post as a card in the grid view: image, title, status, and where it was last. */
function PostCard({
  row,
  inTrash,
  menu,
  remove,
  views,
}: {
  row: PostListRow;
  inTrash: boolean;
  menu: RowMenuItem[];
  remove?: { label: string; onAction: () => void };
  views?: number[];
}) {
  const timeZone = useTimeZone();
  const navigate = useNavigate();
  const date = inTrash
    ? row.deletedAt
    : row.status === 'published'
      ? row.publishedAt
      : (row.scheduledAt ?? row.updatedAt);
  const meta = [row.categories.map((c) => c.name).join(', '), row.author].filter(Boolean);
  return (
    <ListCard
      title={row.title || 'Untitled'}
      image={row.featuredMediaId ? `/api/media/${row.featuredMediaId}?w=640` : null}
      icon={<ImageIcon aria-hidden />}
      // Trashed posts cannot be edited, so their cards only offer the menu.
      onOpen={() => !inTrash && void navigate({ to: '/posts/$postId', params: { postId: row.id } })}
      link={
        inTrash
          ? ({ className, children }) => <span className={className}>{children}</span>
          : ({ className, children }) => (
              <Link to="/posts/$postId" params={{ postId: row.id }} className={className}>
                {children}
              </Link>
            )
      }
      menu={menu}
      remove={remove}
    >
      <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <PostStatusBadge
          status={row.status}
          hasDraft={row.hasDraft}
          trashed={inTrash}
          inReview={row.reviewRequestedAt !== null}
          scheduledAt={row.scheduledAt}
        />
        {date && <span className="shrink-0 tabular-nums"> · {formatDate(date, timeZone)}</span>}
      </span>
      {meta.length > 0 && <CardMeta>{meta.join(' · ')}</CardMeta>}
      {views && <TrendChart series={views} className="mt-1 h-10 w-full" />}
    </ListCard>
  );
}

function PostListItem({
  row,
  inTrash,
  selected,
  select,
  swipe,
  menu,
  previewOpen,
  views,
  onSelect,
}: {
  row: PostListRow;
  inTrash: boolean;
  selected: boolean;
  /** Only people who may trash or restore get tick boxes. */
  select?: React.ComponentProps<typeof ListRow>['select'];
  swipe?: React.ComponentProps<typeof ListRow>['swipe'];
  menu: RowMenuItem[];
  previewOpen: boolean;
  /** Last 30 days of page views, when PostHog is connected. */
  views?: number[];
  onSelect: () => void;
}) {
  const navigate = useNavigate();
  const timeZone = useTimeZone();
  const date = inTrash
    ? row.deletedAt
    : row.status === 'published'
      ? row.publishedAt
      : (row.scheduledAt ?? row.updatedAt);
  // With the preview closed the row has the room for the columns the pane would have shown.
  const wide = !previewOpen;
  const dateLabel = inTrash
    ? 'Trashed'
    : row.status === 'published'
      ? 'Published'
      : row.scheduledAt
        ? 'Scheduled'
        : 'Edited';
  const meta = [row.categories.map((c) => c.name).join(', '), row.author].filter(Boolean);
  // Only live posts: a draft is expected to be unfinished.
  const gaps =
    row.status === 'published' && !inTrash
      ? [row.noDescription && 'search description', row.noShareImage && 'share image'].filter(
          (gap): gap is string => Boolean(gap)
        )
      : [];

  const open = () =>
    inTrash ? undefined : navigate({ to: '/posts/$postId', params: { postId: row.id } });

  return (
    <ListRow
      align="start"
      current={selected}
      select={select}
      swipe={swipe}
      menu={menu}
      previews={!inTrash && previewOpen && isDesktop()}
      // Below lg there is no preview pane: a tap opens the editor instead.
      onOpen={() => (isDesktop() ? onSelect() : open())}
      onDoubleClick={open}
      buttonProps={{
        'data-row': true,
        onKeyDown: onRowKeyDown,
        onPointerEnter: () => void loadPostPreview(row.id),
      }}
    >
      <span className="flex items-center gap-4">
        <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-md">
          {row.featuredMediaId ? (
            <img
              src={`/api/media/${row.featuredMediaId}?w=320`}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span className="text-muted-foreground/60 flex size-full items-center justify-center">
              <ImageIcon aria-hidden className="size-5" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ui block truncate font-medium">{row.title || 'Untitled'}</span>
          <span className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs">
            <PostStatusBadge
              status={row.status}
              hasDraft={row.hasDraft}
              trashed={inTrash}
              inReview={row.reviewRequestedAt !== null}
              scheduledAt={row.scheduledAt}
            />
            {meta.length > 0 && (
              <span className={cn('min-w-0 truncate', wide && 'lg:hidden')}>
                {['', ...meta].join(' · ')}
              </span>
            )}
            {date && (
              <span className={cn('shrink-0 tabular-nums', wide && 'lg:hidden')}>
                {' · '}
                {formatDate(date, timeZone)}
              </span>
            )}
          </span>
          {gaps.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <CircleAlertIcon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">No {gaps.join(' or ')}</span>
            </span>
          )}
        </span>
        {views && (
          <span className={cn('flex shrink-0 max-sm:hidden', wide && 'lg:max-xl:hidden')}>
            <TrendChart series={views} showTotal={wide} />
          </span>
        )}
        {wide && (
          <span className="animate-in fade-in slide-in-from-right-2 hidden shrink-0 items-center gap-6 text-xs duration-300 lg:flex">
            <RowCell
              className="w-40"
              primary={row.categories.map((c) => c.name).join(', ')}
              secondary={row.tags.map((t) => t.name).join(', ')}
            />
            <RowCell className="hidden w-28 xl:block" primary={row.author ?? ''} />
            <RowCell
              className="w-28"
              primary={date ? formatDate(date, timeZone) : ''}
              secondary={dateLabel}
            />
            <RowCell
              className="hidden w-24 text-right 2xl:block"
              primary={formatRelative(row.updatedAt)}
              secondary="Last edit"
            />
          </span>
        )}
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
  onClose,
}: {
  onClose: () => void;
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
      <section aria-label="Preview" className="flex flex-1">
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
    <section aria-label="Preview" className="flex min-h-0 flex-1 flex-col">
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
        <Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
          <PanelRightIcon aria-hidden />
        </Button>
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
          // Keyed by post so choosing another one replays the entrance.
          <div
            key={post.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none"
          >
            <PostArticle post={post} size="pane" />
          </div>
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
  const filtered = Boolean(search.q || search.categories?.length || search.authors?.length);
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
