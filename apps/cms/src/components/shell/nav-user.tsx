import { Link } from '@tanstack/react-router';
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  KeyboardIcon,
  LogOutIcon,
  MessageCircleQuestionIcon,
  UserIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from '@/components/icons';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerBody, DrawerContent } from '@/components/ui/drawer';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { footerLinks } from '@/lib/nav';
import type { SessionUser } from '@/lib/session';
import { setSoundEnabled, useSoundEnabled } from '@/lib/sound';
import { useSignOut } from '@/lib/use-sign-out';
import { cn } from '@/lib/utils';
import { ShortcutsDialog } from './shortcuts-dialog';
import { SheetHeader, sheetGroupClass, sheetRowClass } from './sheet-parts';
import { avatarSrc } from '@/lib/avatar';
import { canReportProblem, openProblemReport } from '@/lib/report-problem';

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
  const soundOn = useSoundEnabled();
  const SoundIcon = soundOn ? VolumeHighIcon : VolumeOffIcon;
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
                <li>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundOn)}
                    className={sheetRowClass}
                  >
                    <SoundIcon aria-hidden className="text-muted-foreground" />
                    <span className="flex-1 text-left">Sounds</span>
                    <span className="text-muted-foreground">{soundOn ? 'On' : 'Off'}</span>
                  </button>
                </li>
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
          className="focus-visible:ring-ring touch-hit relative rounded-full outline-none focus-visible:ring-2 max-md:flex max-md:size-11 max-md:items-center max-md:justify-center max-md:active:opacity-60"
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
            <DropdownMenuItem closeOnClick={false} onClick={() => setSoundEnabled(!soundOn)}>
              <SoundIcon aria-hidden />
              Sounds
              <span className="text-muted-foreground ml-auto text-xs">
                {soundOn ? 'On' : 'Off'}
              </span>
            </DropdownMenuItem>
            {canReport && (
              <DropdownMenuItem onClick={() => void openProblemReport()}>
                <MessageCircleQuestionIcon aria-hidden />
                Report a problem
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
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

      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </>
  );
}
