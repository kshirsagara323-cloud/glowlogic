import { fileURLToPath } from 'node:url';

/** Loads the repo-root .env file if it exists. Real environment variables still win in production. */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch {
    // No .env file (for example on a hosting platform): use real environment variables.
  }
}
