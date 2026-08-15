import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL from here rather than from the datasource
 * block in schema.prisma.
 *
 * The CLI (migrate, db push, introspect) uses DIRECT_URL — the unpooled Neon
 * endpoint. Migrations take advisory locks and issue DDL, neither of which
 * survives a connection pooler. The application itself connects through the
 * pooled DATABASE_URL at runtime.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DIRECT_URL'),
  },
});
