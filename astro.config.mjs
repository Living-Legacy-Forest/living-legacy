import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://livinglegacyforest.com.au',
  // Every route renders on demand so published Sanity content appears
  // immediately, with no rebuild step.
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [
    sanity({
      projectId: process.env.SANITY_PROJECT_ID ?? 'placeholder',
      dataset: 'production',
      useCdn: true,
    }),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      SANITY_PROJECT_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SANITY_DATASET: envField.string({
        context: 'server',
        access: 'secret',
        default: 'production',
      }),
      SANITY_API_VERSION: envField.string({
        context: 'server',
        access: 'secret',
        default: '2026-05-25',
      }),
      PUBLIC_HUBSPOT_PORTAL_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SITE_ENV: envField.string({
        context: 'client',
        access: 'public',
        default: 'production',
      }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_POSTHOG_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_POSTHOG_HOST: envField.string({
        context: 'client',
        access: 'public',
        default: 'https://us.i.posthog.com',
      }),
      PUBLIC_CLOUDINARY_CLOUD_NAME: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SANITY_PROJECT_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_SANITY_DATASET: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      EVENTBRITE_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      EVENTBRITE_ORG_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_CLOUD_NAME: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_API_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CLOUDINARY_API_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
});
