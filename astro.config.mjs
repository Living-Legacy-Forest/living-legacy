import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

export default defineConfig({
  site: 'https://livinglegacyforest.com.au',
  adapter: cloudflare({ imageService: 'compile' }),
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [
    sentry({
      org: 'sister-creatives',
      project: 'living-legacy',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourceMapsUploadOptions: {
        enabled: process.env.NODE_ENV === 'production',
      },
    }),
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
      CLOUDFLARE_DEPLOY_HOOK: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SANITY_WEBHOOK_SECRET: envField.string({
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
