import { type PostInput, SEO_DESCRIPTION_LIMIT, SEO_TITLE_LIMIT } from '@ll/content';
import { notify } from '@/lib/notify';
import { BrandFixButton } from './brand-fix-button';
import { type LocatedField, locateFinding } from './locate-finding';

/** What each field is saved against, so a rewrite never pushes it over. */
const FIELD_LIMITS: Record<LocatedField, number> = {
  title: 200,
  excerpt: 500,
  seoTitle: SEO_TITLE_LIMIT,
  seoDescription: SEO_DESCRIPTION_LIMIT,
  body: 2000,
};

/**
 * "Suggest a fix" for a brand problem in the post being edited. In a plain field the rewrite
 * replaces its sentence in place, with Undo. In the body it is shown to copy, since the rich-text
 * editor is not written to from here.
 */
export function PostBrandFix({
  found,
  values,
  update,
}: {
  found: string;
  values: PostInput;
  update: (patch: Partial<PostInput>) => void;
}) {
  const located = locateFinding(values, found);
  if (!located) return null;
  const { field, sentence } = located;

  const apply =
    field === 'body'
      ? undefined
      : (rewrite: string) => {
          const before = values[field];
          if (!before.includes(sentence)) {
            notify.info({
              title: 'Suggestion not added',
              description: 'That wording has changed. Try again.',
            });
            return;
          }
          update({ [field]: before.replace(sentence, () => rewrite) } as Partial<PostInput>);
          notify.success({
            title: 'Suggestion added',
            description: 'Check it, then save as usual.',
            action: {
              label: 'Undo',
              onClick: () => update({ [field]: before } as Partial<PostInput>),
            },
          });
        };

  // The rewrite may be as long as the field allows once the rest of the field is kept.
  const rest = field === 'body' ? 0 : values[field].length - sentence.length;
  const limit = Math.max(sentence.length, FIELD_LIMITS[field] - rest);

  return <BrandFixButton sentence={sentence} found={found} limit={limit} apply={apply} />;
}
