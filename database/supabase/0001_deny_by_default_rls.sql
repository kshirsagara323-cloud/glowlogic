-- SUPABASE ONLY. Do NOT run on local Docker Postgres (roles anon/authenticated don't exist there).
-- Run once in the Supabase SQL editor AFTER the normal migrations.
--
-- Design: our Express API is the ONLY gatekeeper. Browsers must never read tables
-- directly through Supabase's auto-generated API. So we turn on Row-Level Security
-- with NO policies (= deny everything) and remove table privileges from the public roles.
-- TODO(verify in Phase 4/15): confirm in Supabase docs which role the API connection uses
-- and that it bypasses RLS as intended.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
