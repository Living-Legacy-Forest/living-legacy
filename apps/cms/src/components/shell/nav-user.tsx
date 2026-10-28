import { useRouter } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
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
import { authClient } from '@/lib/auth-client';
import type { SessionUser } from '@/lib/session';

export function NavUser({ user }: { user: SessionUser }) {
  const router = useRouter();
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    await authClient.signOut();
    await router.navigate({ to: '/login' });
  }

  const avatar = (
    <>
      {user.image && <AvatarImage src={user.image} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
      >
        <Avatar className="size-8">{avatar}</Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="pointer-events-none flex items-center gap-2">
            <Avatar className="isolate size-8">{avatar}</Avatar>
            <div className="min-w-0">
              <span className="text-foreground block truncate font-medium">{user.name}</span>
              <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuLabel className="text-muted-foreground pt-0 text-xs font-normal capitalize">
            Role: {user.role}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
