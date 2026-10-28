import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
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
        <PostList title="Drafts" verb="Edited" posts={drafts} empty="No drafts." />
        <PostList
          title="Recently published"
          verb="Published"
          posts={published}
          empty="Nothing published yet."
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
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium">{title}</h2>
      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ItemGroup className="gap-0">
          {posts.map((post) => (
            // Links to the editor once it exists (milestone 3).
            <Item key={post.id} size="sm" className="px-0">
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
