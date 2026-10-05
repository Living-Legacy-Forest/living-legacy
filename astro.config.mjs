import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Dependencies Vite must pre-bundle for SSR at dev-server start, rather than
// discover on the first request that happens to import them. A subpath found
// mid-session makes Vite re-optimise and invalidate every module already
// loaded, and the next request dies on "The file does not exist at
// .../deps_ssr/...". The sister forest site hit this; the same guard is here.
// Anything new imported from @base-ui/react, or first used inside a component,
// belongs in this list. Restart the dev server after any install.
const BASE_UI_SUBPATHS = [
  '@base-ui/react/accordion',
  '@base-ui/react/button',
  '@base-ui/react/checkbox',
  '@base-ui/react/dialog',
  '@base-ui/react/input',
  '@base-ui/react/merge-props',
  '@base-ui/react/navigation-menu',
  '@base-ui/react/preview-card',
  '@base-ui/react/select',
  '@base-ui/react/separator',
  '@base-ui/react/tabs',
  '@base-ui/react/toggle',
  '@base-ui/react/toggle-group',
  '@base-ui/react/use-render',
];

const SSR_DEPS = [
  ...BASE_UI_SUBPATHS,
  // React's own entry points: first reached when an island renders, which
  // otherwise invalidates the SSR dep cache mid-session.
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'class-variance-authority',
  'clsx',
  'embla-carousel-react',
  '@hugeicons/react',
  '@hugeicons/core-free-icons',
  'posthog-node',
  'sonner',
  'tailwind-merge',
  // CommonJS, two levels below @astrojs/react. workerd cannot load CJS, so it
  // has to be pre-bundled into ESM; Vite does not find it on its own.
  '@astrojs/react > @astrojs/internal-helpers > picomatch',
];

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
      projectId: process.env.SANITY_PROJECT_ID ?? '6nf0cv12',
      dataset: 'production',
      useCdn: true,
    }),
    sitemap({
      // Blog posts render on demand from Sanity, so they are listed by the
      // runtime sitemap at /sitemap-blog.xml rather than at build time.
      customSitemaps: ['https://livinglegacyforest.com.au/sitemap-blog.xml'],
      filter: (page) => !page.includes('/thank-you-contact'),
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // SSR only. @astrojs/react already configures the client optimiser, and
    // forcing these through it too produced a second JSX runtime on the sister
    // site, which broke every island on hydration.
    environments: {
      ssr: {
        // No `noDiscovery` here, unlike the sister site: dev SSR runs in
        // workerd, which cannot load CommonJS, so Vite must stay free to
        // discover and convert CJS dependencies (e.g. picomatch, reached via
        // @astrojs/react). Turning discovery off fails with "require is not
        // defined" before the server is ready.
        optimizeDeps: { include: SSR_DEPS },
      },
    },
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
      PUBLIC_GTM_ID: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      PUBLIC_META_PIXEL_ID: envField.string({
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
