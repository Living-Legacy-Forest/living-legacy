import { createDb } from '@ll/db';
import { env } from 'cloudflare:workers';

export const getDb = () => createDb(env.DB);
