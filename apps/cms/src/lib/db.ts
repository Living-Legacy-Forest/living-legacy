import { createDb } from '@llf/db';
import { env } from 'cloudflare:workers';

export const getDb = () => createDb(env.DB);
