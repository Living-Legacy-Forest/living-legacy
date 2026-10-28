import { can } from '@llf/content';
import { useNavigate } from '@tanstack/react-router';
import {
  ArchiveIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Kbd } from '@/components/ui/kbd';
import type { SessionUser } from '@/lib/session';
import { listPostTitles } from '@/server/activity';
import { PostStatusBadge } from '../posts/post-status-badge';

type PostTitle = Awaited<ReturnType<typeof listPostTitles>>[number];

/** Search field in the header that opens a command menu (also on Cmd/Ctrl+K). */
export function CommandMenu({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<PostTitle[] | null>(null);

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

  // Load post titles each time the menu opens, so new posts show up.
  useEffect(() => {
    if (!open) return;
    let active = true;
    listPostTitles().then(
      (rows) => active && setPosts(rows),
      () => active && setPosts([])
    );
    return () => {
      active = false;
    };
  }, [open]);

  const go = (action: () => Promise<void> | void) => {
    setOpen(false);
    void action();
  };
  const canWrite = can(user.role, 'content:write');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-muted/60 text-muted-foreground hover:bg-muted flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors sm:w-64"
      >
        <SearchIcon aria-hidden className="size-3.5" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Jump to a page or find a post by title"
      >
        <Command>
          <CommandInput placeholder="Search or jump to…" />
          <CommandList>
            <CommandEmpty className="p-0">
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchXIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No results</EmptyTitle>
                  <EmptyDescription>Try a different page or post title.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => go(() => navigate({ to: '/' }))}>
                <LayoutDashboardIcon aria-hidden />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go(() => navigate({ to: '/posts' }))}>
                <FileTextIcon aria-hidden />
                All posts
              </CommandItem>
              <CommandItem
                onSelect={() => go(() => navigate({ to: '/posts', search: { status: 'draft' } }))}
              >
                <PencilLineIcon aria-hidden />
                Drafts
              </CommandItem>
              <CommandItem
                onSelect={() => go(() => navigate({ to: '/posts', search: { status: 'trash' } }))}
              >
                <ArchiveIcon aria-hidden />
                Trash
              </CommandItem>
            </CommandGroup>
            {canWrite && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => go(() => navigate({ to: '/posts/new' }))}>
                  <PlusIcon aria-hidden />
                  New post
                </CommandItem>
              </CommandGroup>
            )}
            {posts && posts.length > 0 && (
              <CommandGroup heading="Posts">
                {posts.map((post) => (
                  <CommandItem
                    key={post.id}
                    value={`${post.title} ${post.id}`}
                    onSelect={() =>
                      go(() => navigate({ to: '/posts/$postId', params: { postId: post.id } }))
                    }
                  >
                    <FileTextIcon aria-hidden />
                    <span className="truncate">{post.title || 'Untitled'}</span>
                    <CommandShortcut>
                      <PostStatusBadge status={post.status} />
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
