import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes';

export default defineConfig({
  name: 'living-legacy',
  title: 'Living Legacy Forest',
  projectId: process.env.SANITY_PROJECT_ID ?? 'YOUR_SANITY_PROJECT_ID',
  dataset: 'production',
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
