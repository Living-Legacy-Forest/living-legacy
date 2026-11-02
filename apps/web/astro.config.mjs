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
  // The home hero's optional motion entrance (src/components/ui/hero-04.tsx).
  'motion/react',
  'posthog-node',
  'sonner',
  'tailwind-merge',
  // Sanity content layer: the client and image builder (src/lib/sanity.ts) and
  // the Portable Text renderer (PortableText.astro). First reached when a route
  // that reads from Sanity renders. Left out, Vite discovered them mid-session,
  // re-optimised, and the workerd runner died on a stale deps_ssr chunk.
  '@sanity/client',
  '@sanity/image-url',
  '@portabletext/to-html',
  // The RSS feed helper, imported only by src/pages/rss.xml.ts, so it is first
  // reached when the feed is requested.
  '@astrojs/rss',
  // Astro internals the installed Cloudflare adapter (14.1.4) leaves out of its
  // own pre-bundle list. Adapter 14.4.1 adds them itself, so this block can go
  // once it is upgraded. Each is reached lazily (the manifest a second after
  // boot, the logger on the first request), which on a cold cache made Vite
  // re-optimise mid-session and the workerd runner die on a stale chunk.
  'astro/app/manifest',
  'astro/assets/services/noop',
  'astro/logger/console',
  'astro/logger/json',
  // CommonJS, two levels below @astrojs/react. workerd cannot load CJS, so it
  // has to be pre-bundled into ESM; Vite does not find it on its own.
  '@astrojs/react > @astrojs/internal-helpers > picomatch',
];

export default defineConfig({
  site: 'https://livinglegacy.com.au',
  // Every route renders on demand so published Sanity content appears
  // immediately, with no rebuild step.
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  // Unused. Left on, the adapter adds a SESSION KV binding that every deploy
  // would try to provision.
  session: false,
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
      customSitemaps: ['https://livinglegacy.com.au/sitemap-blog.xml'],
      filter: (page) => !page.includes('/thank-you-contact'),
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Client: the libraries reached only by islands that hydrate late
    // (client:visible / client:idle), so Vite never meets them on the first
    // page load. Found later, they got import URLs into the deps cache whose
    // files the re-optimise never wrote, so every request 404'd and the home
    // map, carousel and FAQ never hydrated. Pre-bundling them at start avoids
    // the mid-session discovery. React itself stays out: @astrojs/react
    // already includes it, and forcing it through again gave the sister site
    // a second JSX runtime that broke every island.
    optimizeDeps: { include: [...BASE_UI_SUBPATHS, 'embla-carousel-react'] },
    // SSR only, for the same reason as the client list above, plus the
    // workerd constraints below.
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
      // Where the blog reads posts not yet moved into the CMS
      // (src/lib/blog-wordpress.ts). Point it at the old site's new address
      // once the domain moves here.
      WORDPRESS_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'https://livinglegacyforest.com',
      }),
      // The CMS, which serves the images uploaded to it (src/lib/blog-cms.ts).
      CMS_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'https://living-legacy-cms.living-legacy.workers.dev',
      }),
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
