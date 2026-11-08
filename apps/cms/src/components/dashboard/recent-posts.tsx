import { ImageIcon, type LucideIcon, PencilLineIcon, SendIcon } from '@/components/icons';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { formatRelative } from '@/lib/format';
import type { PostSummary } from '@/server/dashboard';

export function RecentPosts({
  drafts,
  published,
}: {
  drafts: PostSummary[];
  published: PostSummary[];
}) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Recent posts</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <PostList
          title="Drafts"
          verb="Edited"
          posts={drafts}
          empty={{
            icon: PencilLineIcon,
            title: 'No drafts',
            description: 'Saved drafts show up here.',
          }}
        />
        <PostList
          title="Recently published"
          verb="Published"
          posts={published}
          empty={{
            icon: SendIcon,
            title: 'Nothing published yet',
            description: 'Published posts show up here.',
          }}
        />
      </CardContent>
    </Card>
  );
}

function PostList({
  title,
  verb,
  posts,
  empty,
}: {
  title: string;
  verb: string;
  posts: PostSummary[];
  empty: { icon: LucideIcon; title: string; description: string };
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase">
        {title}
      </h2>
      {posts.length === 0 ? (
        <Empty className="border py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <empty.icon aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{empty.title}</EmptyTitle>
            <EmptyDescription>{empty.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-0 max-md:divide-y max-md:divide-(--ios-separator)">
          {posts.map((post) => (
            <Item
              key={post.id}
              size="sm"
              className="-mx-2 px-2"
              render={<Link to="/posts/$postId" params={{ postId: post.id }} />}
            >
              <ItemMedia variant="image" className="bg-muted text-muted-foreground border">
                {post.imageId ? (
                  <img src={`/api/media/${post.imageId}`} alt="" loading="lazy" />
                ) : (
                  <ImageIcon aria-hidden className="size-3.5" />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="line-clamp-1">{post.title || 'Untitled'}</ItemTitle>
                <ItemDescription>
                  {verb} {formatRelative(post.at)}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
