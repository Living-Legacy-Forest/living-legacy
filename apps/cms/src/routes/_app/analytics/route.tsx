import { can } from '@ll/content';
import { createFileRoute, redirect } from '@tanstack/react-router';

// Every Analytics page is for admins and editors, as the server functions behind them are.
export const Route = createFileRoute('/_app/analytics')({
  beforeLoad: ({ context }) => {
    if (!can(context.user.role, 'posts:publish')) throw redirect({ to: '/' });
  },
});
