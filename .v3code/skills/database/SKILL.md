---
name: database
description: Database operations, queries, and schema design
keywords:
  - database
  - SQL
  - query
  - schema
  - migration
  - index
  - join
  - postgres
  - mysql
  - sqlite
  - mongo
  - prisma
  - drizzle
  - ORM
alwaysApply: false
---

# Database Skill

## Schema Design Principles

1. **Normalize to 3NF** for transactional data (avoid update anomalies)
2. **Denormalize for reads** only when you have measured performance issues
3. **Every table needs a primary key** — prefer UUIDs or auto-increment IDs
4. **Use timestamps** — `created_at` and `updated_at` on every table
5. **Soft deletes** (`deleted_at`) for data you might need to recover

## Indexing Rules

- Index columns used in WHERE, JOIN, and ORDER BY
- Composite indexes: put high-cardinality columns first
- Don't over-index — each index slows writes
- Use EXPLAIN/ANALYZE to verify queries use indexes

## Query Anti-Patterns

### N+1 Queries
```
BAD:  SELECT * FROM users; then for each: SELECT * FROM posts WHERE user_id = ?
GOOD: SELECT * FROM users JOIN posts ON posts.user_id = users.id
```

### SELECT *
```
BAD:  SELECT * FROM users (returns 50 columns when you need 3)
GOOD: SELECT id, name, email FROM users
```

### Missing LIMIT
```
BAD:  SELECT * FROM logs WHERE level = 'error'  (could return millions)
GOOD: SELECT * FROM logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 100
```

## Migration Best Practices

- Migrations are forward-only (never edit existing ones)
- Each migration should be reversible (include down/rollback)
- Test migrations on a copy of production data
- Never drop columns without first removing code references
- Add columns as nullable first, backfill, then add NOT NULL

## ORM Tips

- Use raw queries for complex analytics/reporting
- Don't trust the ORM to generate optimal queries — check generated SQL
- Use transactions for multi-table writes
- Set query timeouts to prevent long-running queries from blocking
