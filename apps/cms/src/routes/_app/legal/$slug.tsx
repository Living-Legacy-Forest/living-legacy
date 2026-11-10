import { can, legalSlugSchema } from '@ll/content';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { LegalPageEditor } from '@/components/legal/legal-page-editor';
import { getLegalPageEditorData } from '@/server/legal-pages';

export const Route = createFileRoute('/_app/legal/$slug')({
  loader: ({ params }) => {
    const slug = legalSlugSchema.safeParse(params.slug);
    if (!slug.success) throw notFound();
    return getLegalPageEditorData({ data: { slug: slug.data } });
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.values.title ?? 'Legal page'} | Living Legacy CMS` }],
  }),
  component: LegalPageRoute,
});

function LegalPageRoute() {
  const data = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  return (
    <LegalPageEditor
      key={`${data.slug}:${data.updatedAt}`}
      data={data}
      canPublish={can(user.role, 'legal:publish')}
    />
  );
}
