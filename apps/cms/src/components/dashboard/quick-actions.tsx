import { type Permission, can } from '@llf/content';
import { Link } from '@tanstack/react-router';
import {
  FilePlus2Icon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  UploadIcon,
  UserPlusIcon,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import type { SessionUser } from '@/lib/session';

type Action = {
  title: string;
  /** Set once the destination exists; otherwise the action shows as "Soon". */
  to?: '/posts/new';
  description: string;
  icon: LucideIcon;
  permission: Permission;
};

const actions: Action[] = [
  {
    title: 'New post',
    description: 'Write a blog post.',
    to: '/posts/new',
    icon: FilePlus2Icon,
    permission: 'posts:write',
  },
  {
    title: 'Upload media',
    description: 'Add photos and documents.',
    icon: UploadIcon,
    permission: 'media:write',
  },
  {
    title: 'Add an FAQ',
    description: 'Answer a common question.',
    icon: MessageCircleQuestionIcon,
    permission: 'content:write',
  },
  {
    title: 'Invite someone',
    description: 'Give a colleague access.',
    icon: UserPlusIcon,
    permission: 'users:manage',
  },
];

export function QuickActions({ user }: { user: SessionUser }) {
  const visible = actions.filter((action) => can(user.role, action.permission));

  return (
    <Card className="col-span-2 lg:col-span-4">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Shortcuts to common tasks.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((action) =>
          action.to ? (
            <Item key={action.title} variant="outline" size="sm" render={<Link to={action.to} />}>
              <ActionBody action={action} />
            </Item>
          ) : (
            <Item
              key={action.title}
              variant="outline"
              size="sm"
              aria-disabled
              className="opacity-70"
            >
              <ActionBody action={action} />
              <ItemActions>
                <Badge variant="outline">Soon</Badge>
              </ItemActions>
            </Item>
          )
        )}
      </CardContent>
    </Card>
  );
}

function ActionBody({ action }: { action: Action }) {
  return (
    <>
      <ItemMedia variant="icon">
        <action.icon aria-hidden />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{action.title}</ItemTitle>
        <ItemDescription className="line-clamp-1">{action.description}</ItemDescription>
      </ItemContent>
    </>
  );
}
