import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Link } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  KeyboardIcon,
  LogOutIcon,
  MessageCircleQuestionIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  SunMoonIcon,
  UserIcon,
} from '@/components/icons';
import { type ComponentType, useState } from 'react';
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
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerBody, DrawerContent } from '@/components/ui/drawer';
import {
  ShortcutList,
  type ShortcutListGroup,
} from '@/components/arc/shortcut-recorder/shortcut-recorder';
import { PillGlide, pillItemClass, pillTrackClass } from '@/components/ui/pill-track';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { footerLinks } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { useSignOut } from '@/lib/use-sign-out';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { cn } from '@/lib/utils';
import type { Theme } from '@/server/settings';
import { SheetHeader, sheetGroupClass, sheetRowClass } from './sheet-parts';
import { avatarSrc } from '@/lib/avatar';
import { canReportProblem, openProblemReport } from '@/lib/report-problem';

const shortcutGroups: ShortcutListGroup[] = [
  {
    label: 'Anywhere',
    items: [
      { label: 'Search or jump to a page', shortcut: 'mod+k' },
      { label: 'Show or hide the sidebar', shortcut: 'mod+b' },
    ],
  },
  {
    label: 'Posts',
    items: [
      { label: 'Save the post you are editing', shortcut: 'mod+s' },
      { label: 'Move up the posts list', shortcut: 'up' },
      { label: 'Move down the posts list', shortcut: 'down' },
    ],
  },
  {
    label: 'Lists',
    items: [
      { label: 'Select the focused row', shortcut: 'x' },
      {
        label: 'Delete the focused row, or move a post to the trash',
        shortcut: 'backspace',
        keywords: 'remove',
      },
      { label: 'Move the focused FAQ or team member up', shortcut: 'alt+up' },
      { label: 'Move the focused FAQ or team member down', shortcut: 'alt+down' },
    ],
  },
];

const themes: {
  value: Theme;
  label: string;

  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'Match my device', icon: MonitorIcon },
];

/** The sign-out label: the new words rise into place, so "Signing out" reads as progress. */
export function SignOutLabel({ signingOut }: { signingOut: boolean }) {
  const text = signingOut ? 'Signing out' : 'Sign out';
  return (
    <span
      key={text}
      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
    >
      {text}
    </span>
  );
}

export function NavUser({ user }: { user: SessionUser }) {
  const isPhone = useIsMobile();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { signingOut, signOut } = useSignOut();
  const theme = useThemeChoice();
  // Sentry runs in production only, so the item shows there; read once it has loaded.
  const [canReport] = useState(() => typeof window !== 'undefined' && canReportProblem());
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatar = (
    <>
      {avatarSrc(user) && <AvatarImage src={avatarSrc(user)} alt="" />}
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </>
  );
  const website = footerLinks[0];

  if (isPhone) {
    const close = () => setSheetOpen(false);
    return (
      <>
        <button
          type="button"
          aria-label="Account"
          onClick={() => setSheetOpen(true)}
          className="flex size-11 items-center justify-center rounded-full active:opacity-60"
        >
          <Avatar className="size-8">{avatar}</Avatar>
        </button>
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerContent className="bg-(--ios-grouped)">
            <SheetHeader title="Account" onDone={close} />
            <DrawerBody className="flex flex-col gap-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
              <div className="bg-background flex items-center gap-3 rounded-xl px-4 py-3">
                <Avatar className="size-12">{avatar}</Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.0625rem] font-semibold">{user.name}</p>
                  <p className="text-muted-foreground truncate text-[0.8125rem]">{user.email}</p>
                </div>
                <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs capitalize">
                  {user.role}
                </span>
              </div>
              <ul className={sheetGroupClass}>
                <li>
                  <Link to="/profile" onClick={close} className={sheetRowClass}>
                    <UserIcon aria-hidden className="text-muted-foreground" />
                    <span className="flex-1">Edit profile</span>
                    <ChevronRightIcon aria-hidden className="text-muted-foreground/60 size-4!" />
                  </Link>
                </li>
                {website && (
                  <li>
                    <a
                      href={website.href}
                      target="_blank"
                      rel="noreferrer"
                      className={sheetRowClass}
                    >
                      <ExternalLinkIcon aria-hidden className="text-muted-foreground" />
                      <span className="flex-1">View website</span>
                    </a>
                  </li>
                )}
                {canReport && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void openProblemReport();
                      }}
                      className={sheetRowClass}
                    >
                      <MessageCircleQuestionIcon aria-hidden className="text-muted-foreground" />
                      <span className="flex-1 text-left">Report a problem</span>
                    </button>
                  </li>
                )}
              </ul>
              <ul className={sheetGroupClass}>
                <li>
                  <button
                    type="button"
                    onClick={signOut}
                    className={cn(sheetRowClass, 'text-destructive')}
                  >
                    <LogOutIcon aria-hidden />
                    Sign out
                  </button>
                </li>
              </ul>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Keyboard shortcuts only on larger screens: a phone has no keyboard to use them with.
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2 max-md:flex max-md:size-11 max-md:items-center max-md:justify-center max-md:active:opacity-60"
        >
          <Avatar className="size-7 max-md:size-8">{avatar}</Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="pointer-events-none flex items-center gap-2.5 py-2">
              <Avatar className="isolate size-8">{avatar}</Avatar>
              <span className="min-w-0">
                <span className="text-foreground text-ui block truncate font-medium">
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
            <DropdownMenuItem render={<Link to="/profile" />}>
              <UserIcon aria-hidden />
              Edit profile
            </DropdownMenuItem>
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
            {canReport && (
              <DropdownMenuItem onClick={() => void openProblemReport()}>
                <MessageCircleQuestionIcon aria-hidden />
                Report a problem
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {/* One stop per choice: up and down pass through them, and choosing keeps the menu open. */}
          <div className="text-ui flex items-center gap-1.5 py-0.5 pl-1.5">
            <SunMoonIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
            <span className="flex-1" aria-hidden>
              Theme
            </span>
            <DropdownMenuRadioGroup
              aria-label="Theme"
              value={theme.effective}
              onValueChange={(next) => void theme.choose(next as Theme)}
              className={pillTrackClass}
            >
              <PillGlide value={theme.effective} selector=':scope > [aria-checked="true"]' />
              {themes.map(({ value, label, icon: Icon }) => (
                <MenuPrimitive.RadioItem
                  key={value}
                  value={value}
                  aria-label={label}
                  title={label}
                  className={cn(
                    pillItemClass,
                    'aria-checked:text-foreground data-highlighted:text-foreground size-7 cursor-default px-0'
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </MenuPrimitive.RadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            aria-busy={signingOut || undefined}
            onClick={signOut}
          >
            {signingOut ? <Spinner aria-hidden /> : <LogOutIcon aria-hidden />}
            <SignOutLabel signingOut={signingOut} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Hold a key to see what it does. Right-click a row to see every action for it, with its
              key.
            </DialogDescription>
          </DialogHeader>
          <ShortcutList groups={shortcutGroups} label="Keyboard shortcuts" />
        </DialogContent>
      </Dialog>
    </>
  );
}
