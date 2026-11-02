import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';

import { getAllBlogPosts } from '@/lib/blog-posts';

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const posts = await getAllBlogPosts();

  return rss({
    title: 'Living Legacy Blog',
    description:
      'Stories, insights, and reflections on nature, healing, remembrance, and the powerful connection between life and the forest.',
    site: site ?? 'https://livinglegacy.com.au',
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.publishedAt),
      description: post.excerpt,
      link: `/blog/${post.slug}/`,
      categories: post.category ? [post.category.title] : undefined,
      author: post.author?.name,
    })),
    customData: '<language>en-au</language>',
  });
};
