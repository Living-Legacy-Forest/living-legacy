import { type Permission, can } from '@llf/content';
import {
  FilePlus2Icon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  UploadIcon,
  UserPlusIcon,
} from 'lucide-react';
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
  description: string;
  icon: LucideIcon;
  permission: Permission;
};

// Each becomes a link as its section of the CMS is built.
const actions: Action[] = [
  {
    title: 'New post',
    description: 'Write a blog post.',
    icon: FilePlus2Icon,
    permission: 'content:write',
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
        {visible.map((action) => (
          <Item key={action.title} variant="outline" size="sm" aria-disabled className="opacity-70">
            <ItemMedia variant="icon">
              <action.icon aria-hidden />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{action.title}</ItemTitle>
              <ItemDescription className="line-clamp-1">{action.description}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">Soon</Badge>
            </ItemActions>
          </Item>
        ))}
      </CardContent>
    </Card>
  );
}
