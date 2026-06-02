import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID ?? 'placeholder',
  dataset: import.meta.env.SANITY_DATASET ?? 'production',
  apiVersion: import.meta.env.SANITY_API_VERSION ?? '2026-05-25',
  useCdn: true,
});
