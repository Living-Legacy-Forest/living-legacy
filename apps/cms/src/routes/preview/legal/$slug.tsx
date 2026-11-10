import { legalSlugSchema } from '@ll/content';
import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { PostPreviewBody } from '@/components/posts/post-preview';
import { getCurrentUser } from '@/lib/session';
import { getLegalPagePreview } from '@/server/legal-pages';

export const Route = createFileRoute('/preview/legal/$slug')({
  beforeLoad: async () => {
    if (!(await getCurrentUser())) throw redirect({ to: '/login' });
  },
  loader: ({ params }) => {
    const slug = legalSlugSchema.safeParse(params.slug);
    if (!slug.success) throw notFound();
    return getLegalPagePreview({ data: { slug: slug.data } });
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Preview: ${loaderData?.title ?? 'Legal page'} | Living Legacy CMS` }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const page = Route.useLoaderData();
  return (
    <div className="bg-background min-h-svh">
      <div className="bg-background/80 text-ui sticky top-0 z-10 flex h-11 items-center gap-3 border-b px-4 backdrop-blur">
        <span className="font-medium">Preview</span>
        <span className="text-muted-foreground">
          {page.hasDraft ? 'Unpublished changes' : 'The published version'}
        </span>
      </div>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight">{page.title}</h1>
        <div className="mt-10">
          <PostPreviewBody body={page.body} />
        </div>
      </article>
    </div>
  );
}
