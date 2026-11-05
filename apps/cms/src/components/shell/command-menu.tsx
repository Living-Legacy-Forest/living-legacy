import { can } from '@ll/content';
import { useNavigate } from '@tanstack/react-router';
import {
  ArchiveIcon,
  CalendarClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PanelLeftIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
} from '@/components/icons';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { formatRelative } from '@/lib/format';
import { footerLinks } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { type SearchResults, searchContent } from '@/server/search';
import { PostStatusBadge } from '../posts/post-status-badge';

type StaticItem = { label: string; icon: LucideIcon; keywords?: string; run: () => void };

/** Wraps each case-insensitive occurrence of `query` in a highlight. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200/70 text-inherit">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/** Cuts a long text around the first match so the match is visible. */
function aroundMatch(text: string, query: string, radius = 48) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0 || text.length <= radius * 2) return text;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** Search field in the header that opens a command menu (also on Cmd/Ctrl+K). */
export function CommandMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced server search; an empty query loads recent posts.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        searchContent({ data: { q: query } })
          .then((next) => active && setResults(next))
          .catch(() => active && setResults({ query, posts: [], categories: [] }))
          .finally(() => active && setLoading(false));
      },
      query ? 150 : 0
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const go = (action: () => unknown) => {
    close();
    void action();
  };

  const q = query.trim();
  const matches = (item: StaticItem) =>
    !q || `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q.toLowerCase());

  const pages: StaticItem[] = [
    {
      label: 'Dashboard',
      icon: LayoutDashboardIcon,
      keywords: 'home overview',
      run: () => navigate({ to: '/' }),
    },
    {
      label: 'All posts',
      icon: FileTextIcon,
      keywords: 'blog articles',
      run: () => navigate({ to: '/posts' }),
    },
    {
      label: 'Scheduled posts',
      icon: CalendarClockIcon,
      keywords: 'later queue',
      run: () => navigate({ to: '/posts', search: { status: 'scheduled' } }),
    },
    {
      label: 'Drafts',
      icon: PencilLineIcon,
      keywords: 'unpublished',
      run: () => navigate({ to: '/posts', search: { status: 'draft' } }),
    },
    {
      label: 'Trash',
      icon: ArchiveIcon,
      keywords: 'deleted bin',
      run: () => navigate({ to: '/posts', search: { status: 'trash' } }),
    },
  ];
  const actions: StaticItem[] = [
    ...(can(user.role, 'posts:write')
      ? [
          {
            label: 'New post',
            icon: PlusIcon,
            keywords: 'write create add',
            run: () => navigate({ to: '/posts/new' }),
          },
        ]
      : []),
    {
      label: 'Toggle sidebar',
      icon: PanelLeftIcon,
      keywords: 'hide show collapse',
      run: toggleSidebar,
    },
    ...footerLinks.map((link) => ({
      label: link.title,
      icon: ExternalLinkIcon,
      keywords: 'site public open',
      run: () => window.open(link.href, '_blank', 'noreferrer'),
    })),
  ];
  const visiblePages = pages.filter(matches);
  const visibleActions = actions.filter(matches);
  // Only show results that belong to what is currently typed.
  const current = results && results.query === q ? results : null;
  const posts = current?.posts ?? [];
  const categories = current?.categories ?? [];
  const nothing =
    !loading &&
    current &&
    posts.length === 0 &&
    categories.length === 0 &&
    !visiblePages.length &&
    !visibleActions.length;

  return (
    <>
      {/* Lives at the top of the sidebar, so it never sits beside a page's own search. */}
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Search (⌘K)"
          onClick={() => setOpen(true)}
          className="bg-sidebar-accent/60 text-muted-foreground hover:text-sidebar-foreground h-8 text-[13px]"
        >
          <SearchIcon aria-hidden />
          <span className="flex-1 text-left">Search…</span>
          <Kbd className="group-data-[collapsible=icon]:hidden">⌘K</Kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <CommandDialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="Search"
        description="Search posts and categories, or jump to a page"
        className="sm:max-w-xl"
      >
        <Command shouldFilter={false} loop>
          <div className="relative">
            <CommandInput
              placeholder="Search posts, categories and pages…"
              value={query}
              onValueChange={setQuery}
            />
            {loading && (
              <Spinner className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2" />
            )}
          </div>
          <CommandList className="max-h-[min(28rem,60vh)]">
            {nothing && (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchXIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No results for “{q}”</EmptyTitle>
                  <EmptyDescription>
                    Search looks in post titles, summaries and text, and category names.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {posts.length > 0 && (
              <CommandGroup heading={q ? 'Posts' : 'Recently edited'}>
                {posts.map((post) => {
                  const context =
                    post.snippet ??
                    (post.excerpt?.toLowerCase().includes(q.toLowerCase()) ? post.excerpt : null);
                  return (
                    <CommandItem
                      key={post.id}
                      value={`post-${post.id}`}
                      onSelect={() =>
                        go(() => navigate({ to: '/posts/$postId', params: { postId: post.id } }))
                      }
                      className="items-start py-2"
                    >
                      <FileTextIcon aria-hidden className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            <Highlight text={post.title || 'Untitled'} query={q} />
                          </span>
                          <PostStatusBadge
                            status={post.status}
                            hasDraft={post.hasDraft}
                            scheduledAt={post.scheduledAt}
                            className="shrink-0"
                          />
                        </span>
                        {q && context ? (
                          <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                            <Highlight text={aroundMatch(context, q)} query={q} />
                          </span>
                        ) : (
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            {[post.category, `Edited ${formatRelative(post.updatedAt)}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {categories.length > 0 && (
              <CommandGroup heading="Categories">
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={`category-${category.id}`}
                    onSelect={() =>
                      go(() =>
                        navigate({ to: '/posts', search: { status: 'all', category: category.id } })
                      )
                    }
                  >
                    <FolderIcon aria-hidden />
                    <span className="flex-1">
                      Posts in <Highlight text={category.name} query={q} />
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {category.posts}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <StaticGroup heading="Go to" items={visiblePages} query={q} onRun={go} />
            <StaticGroup heading="Actions" items={visibleActions} query={q} onRun={go} />
          </CommandList>
          <div className="text-muted-foreground flex items-center gap-4 border-t px-3 py-2 text-xs">
            <Hint keys={['↑', '↓']}>Move</Hint>
            <Hint keys={['↵']}>Open</Hint>
            <Hint keys={['esc']}>Close</Hint>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

function StaticGroup({
  heading,
  items,
  query,
  onRun,
}: {
  heading: string;
  items: StaticItem[];
  query: string;
  onRun: (action: () => unknown) => void;
}) {
  if (!items.length) return null;
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => (
        <CommandItem
          key={item.label}
          value={`static-${item.label}`}
          onSelect={() => onRun(item.run)}
        >
          <item.icon aria-hidden />
          <Highlight text={item.label} query={query} />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      {children}
    </span>
  );
}
