import { useRouter } from '@tanstack/react-router';
import { ExternalLinkIcon, KeyboardIcon, LogOutIcon } from '@/components/icons';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { authClient } from '@/lib/auth-client';
import { footerLinks } from '@/lib/nav';
import { type SessionUser, forgetCachedUser } from '@/lib/session';

const shortcuts: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Search or jump to a page' },
  { keys: ['⌘', 'B'], label: 'Show or hide the sidebar' },
  { keys: ['⌘', 'S'], label: 'Save the post you are editing' },
  { keys: ['↑', '↓'], label: 'Move through the posts list' },
];

export function NavUser({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    forgetCachedUser();
    await router.navigate({ to: '/login' });
  }

  const avatar = (
    <>
      {user.image && <AvatarImage src={user.image} alt="" />}
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </>
  );
  const website = footerLinks[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
        >
          <Avatar className="size-7">{avatar}</Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="pointer-events-none flex items-center gap-2.5 py-2">
              <Avatar className="isolate size-8">{avatar}</Avatar>
              <span className="min-w-0">
                <span className="text-foreground block truncate text-[13px] font-medium">
                  {user.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs font-normal">
                  {user.email}
                </span>
              </span>
              <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[11px] font-normal capitalize">
                {user.role}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {website && (
              <DropdownMenuItem render={<a href={website.href} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon aria-hidden />
                View website
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowShortcuts(true)}>
              <KeyboardIcon aria-hidden />
              Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOutIcon aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Use Ctrl in place of ⌘ on Windows.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5 text-[13px]">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.label} className="flex items-center justify-between gap-4">
                <span>{shortcut.label}</span>
                <KbdGroup>
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
