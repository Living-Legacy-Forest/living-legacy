import { defineField, defineType } from 'sanity';

// A finer grain than category. WordPress carried both taxonomies on every
// post, and the tag archive (/blog/tag/[slug]/) is one of the routes the
// rebuilt blog has to serve, so the taxonomy needs a home in the schema too.
export const tag = defineType({
  name: 'tag',
  title: 'Tag',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'title' },
  },
});
