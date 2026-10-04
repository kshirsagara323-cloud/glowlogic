// Tiny database helper (no framework). Usage: node scripts/db/migrate.mjs <command>
//   migrate  apply new files from database/migrations (tracked in schema_migrations)
//   seed     run database/seeds/*.sql (safe to repeat)
//   test     run database/tests/*.sql
//   reset    LOCAL ONLY: wipe the public schema, then migrate + seed
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

try { process.loadEnvFile('.env'); } catch { /* no .env file: rely on real environment variables */ }

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'database');
const files = (dir) => readdirSync(join(dbDir, dir)).filter((f) => f.endsWith('.sql')).sort();
const read = (dir, f) => readFileSync(join(dbDir, dir, f), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');

const client = new pg.Client({ connectionString: url });
client.on('notice', (n) => console.log('  ' + n.message));

async function migrate() {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));
  for (const f of files('migrations')) {
    const sql = read('migrations', f);
    const sum = sha(sql);
    if (applied.has(f)) {
      if (applied.get(f) !== sum) {
        throw new Error(`${f} was edited after it was applied. Never edit applied migrations; add a new one.`);
      }
      console.log(`skip   ${f}`);
      continue;
    }
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [f, sum]);
      await client.query('COMMIT');
      console.log(`apply  ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`${f} failed: ${e.message}`);
    }
  }
}

async function runDir(dir) {
  for (const f of files(dir)) {
    console.log(`run    ${dir}/${f}`);
    try {
      await client.query(read(dir, f));
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`${f} failed: ${e.message}`);
    }
  }
}

async function reset() {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error(`Refusing to reset a non-local database (host: ${host}).`);
  }
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  console.log('schema wiped');
  await migrate();
  await runDir('seeds');
}

const commands = { migrate, seed: () => runDir('seeds'), test: () => runDir('tests'), reset };
const cmd = process.argv[2] ?? 'migrate';

if (!commands[cmd]) {
  console.error(`Unknown command "${cmd}". Use: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

try {
  await client.connect();
  await commands[cmd]();
  console.log('done');
} catch (e) {
  if (e.code === 'ECONNREFUSED') {
    console.error('Cannot reach the database. Is Docker running? Try: npm run db:up');
  } else {
    console.error('ERROR: ' + e.message);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
