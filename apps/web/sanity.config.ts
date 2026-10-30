import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes';

export default defineConfig({
  name: 'living-legacy',
  title: 'Living Legacy',
  projectId: process.env.SANITY_PROJECT_ID ?? '6nf0cv12',
  dataset: 'production',
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
