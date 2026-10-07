import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_VERSION: z.string().default('0.1.0'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Name the variables only. Never print values (they may be secrets).
    const names = [...new Set(result.error.issues.map((i) => i.path.map(String).join('.')))];
    throw new Error(`Invalid environment configuration. Check these variables in your .env: ${names.join(', ')}`);
  }
  return result.data;
}
