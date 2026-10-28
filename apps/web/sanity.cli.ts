import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_PROJECT_ID ?? '6nf0cv12',
    dataset: 'production',
  },
  studioHost: 'living-legacy',
});
