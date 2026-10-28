import type { SchemaTypeDefinition } from 'sanity';

import { author } from './author';
import { blog } from './blog';
import { category } from './category';
import { tag } from './tag';

export const schemaTypes: SchemaTypeDefinition[] = [blog, author, category, tag];
