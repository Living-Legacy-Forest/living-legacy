import { defineField, defineType } from 'sanity';

// Ported from the sister forest site's `blog` type, with a `tags` taxonomy
// added (the WordPress source carried both categories and tags, and
// /blog/tag/[slug]/ is one of the routes the rebuilt blog serves) and two
// migration-support fields: `updatedAt` carries WordPress's modified date
// forward so the article page can show "updated" separately from
// "published", and `wpId` is the source post's numeric id, kept read-only so
// the migration script can always find its way back to a document it wrote
// even if the slug changes later.
export const blog = defineType({
  name: 'blog',
  title: 'Blog',
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
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      description: 'A future date holds the post back until then.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
      description: 'Shown on the article as "Updated" when later than the published date.',
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'tag' }] }],
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'isFeatured',
      title: 'Featured',
      type: 'boolean',
      description: 'Lifts this post to the top of the blog index. Only one is shown.',
      initialValue: false,
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      description: 'Shown on the index and used as the share description.',
    }),
    defineField({
      name: 'featuredImage',
      title: 'Featured image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'H2', value: 'h2' },
            { title: 'H3', value: 'h3' },
            { title: 'H4', value: 'h4' },
            { title: 'Quote', value: 'blockquote' },
          ],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
              { title: 'Underline', value: 'underline' },
              { title: 'Strikethrough', value: 'strike-through' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  defineField({
                    name: 'href',
                    title: 'URL',
                    type: 'url',
                    validation: (rule) =>
                      rule.uri({ allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel'] }),
                  }),
                  defineField({
                    name: 'target',
                    title: 'Open in new tab',
                    type: 'boolean',
                    initialValue: false,
                  }),
                ],
              },
            ],
          },
          lists: [
            { title: 'Bullet', value: 'bullet' },
            { title: 'Number', value: 'number' },
          ],
        },
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({ name: 'caption', title: 'Caption', type: 'string' }),
          ],
        },
        {
          type: 'object',
          name: 'youtube',
          title: 'YouTube embed',
          fields: [
            defineField({
              name: 'url',
              title: 'YouTube URL',
              type: 'url',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { url: 'url' },
            prepare: ({ url }: { url?: string }) => ({ title: `YouTube: ${url ?? 'no URL'}` }),
          },
        },
        {
          type: 'object',
          name: 'table',
          title: 'Table',
          preview: {
            select: { rows: 'rows', hasHeader: 'hasHeader' },
            prepare({ rows, hasHeader }: { rows?: unknown[]; hasHeader?: boolean }) {
              const count = rows?.length ?? 0;
              const note = hasHeader ? ' (with header)' : '';
              return { title: `Table, ${count} row${count !== 1 ? 's' : ''}${note}` };
            },
          },
          fields: [
            defineField({
              name: 'hasHeader',
              title: 'First row is a header',
              type: 'boolean',
              initialValue: true,
            }),
            defineField({
              name: 'rows',
              title: 'Rows',
              type: 'array',
              description: 'Each row: cell values separated by a pipe, for example "Name | Age".',
              of: [
                {
                  type: 'object',
                  name: 'tableRow',
                  title: 'Row',
                  preview: {
                    select: { cells: 'cells' },
                    prepare: ({ cells }: { cells?: string }) => ({ title: cells || 'Empty row' }),
                  },
                  fields: [
                    defineField({
                      name: 'cells',
                      title: 'Cells',
                      type: 'text',
                      rows: 3,
                      description: 'Separate columns with a pipe.',
                    }),
                  ],
                },
              ],
            }),
          ],
        },
      ],
    }),
    defineField({
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      description: 'Falls back to the post title.',
    }),
    defineField({
      name: 'seoDescription',
      title: 'SEO description',
      type: 'text',
      rows: 3,
      description: 'Falls back to the excerpt.',
      validation: (rule) =>
        rule.custom((value) => {
          if (!value) return true;
          if (value.length < 120) return 'SEO description should be at least 120 characters';
          if (value.length > 160) return 'SEO description should be at most 160 characters';
          return true;
        }),
    }),
    defineField({
      name: 'wpId',
      title: 'WordPress post ID',
      type: 'number',
      readOnly: true,
      description: 'Set by the migration. Keeps a migrated post idempotent across re-runs.',
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'publishedAt', media: 'featuredImage' },
  },
});
