import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL from here rather than from the datasource
 * block in schema.prisma. DATABASE_URL is the Neon connection string.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
});
