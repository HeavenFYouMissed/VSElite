/**
 * Bootstrap migration runner.
 *
 * Run via: `npm run db:migrate`
 *
 * Order:
 *   1. CREATE EXTENSION pgvector (must precede Drizzle migrations)
 *   2. Apply Drizzle-generated SQL migrations from ./migrations
 *   3. Create HNSW indexes on vector columns (Drizzle doesn't model these)
 *
 * Drizzle-generated migrations live in src/db/migrations/ and are produced by `npm run db:generate`.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadConfig } from '../config.js';

async function main() {
	const cfg = loadConfig();
	const sql = postgres(cfg.DATABASE_URL, { max: 1 });

	console.log('[migrate] ensuring pgvector extension...');
	await sql`CREATE EXTENSION IF NOT EXISTS vector;`;

	console.log('[migrate] applying drizzle migrations...');
	const db = drizzle(sql);
	await migrate(db, { migrationsFolder: './src/db/migrations' });

	console.log('[migrate] ensuring HNSW vector indexes...');
	// HNSW indexes — built after tables exist. m=16, ef_construction=64 are pgvector defaults
	// suitable for ~100k vectors per partition. Tune later if recall drops.
	await sql`
		CREATE INDEX IF NOT EXISTS cache_l2_embedding_hnsw
		ON cache_l2 USING hnsw (embedding vector_cosine_ops)
		WITH (m = 16, ef_construction = 64);
	`;
	await sql`
		CREATE INDEX IF NOT EXISTS cache_l3_embedding_hnsw
		ON cache_l3 USING hnsw (embedding vector_cosine_ops)
		WITH (m = 16, ef_construction = 64)
		WHERE status = 'active';
	`;

	console.log('[migrate] done.');
	await sql.end();
}

main().catch(err => {
	console.error('[migrate] failed:', err);
	process.exit(1);
});
