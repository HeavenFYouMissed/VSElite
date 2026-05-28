import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { loadConfig } from '../config.js';
import * as schema from './schema.js';

const cfg = loadConfig();

// Single shared connection pool. postgres-js handles pooling internally.
export const sql = postgres(cfg.DATABASE_URL, {
	max: 20,
	idle_timeout: 30,
	connect_timeout: 10
});

export const db = drizzle(sql, { schema });

export type DB = typeof db;
export { schema };
