-- 0005_updated_at_triggers.sql
-- Attach set_updated_at() to every base table that has an updated_at column.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',
                   'trg_' || r.table_name || '_updated_at', r.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                   'trg_' || r.table_name || '_updated_at', r.table_name);
  END LOOP;
END $$;
