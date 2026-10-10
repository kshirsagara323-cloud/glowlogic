-- 0008_recommendation_output.sql
-- Keep the complete output (routine, reasons, exclusions) of every recommendation run, so an old
-- result can be shown exactly as it was generated, even after products or rules change.
ALTER TABLE recommendation_run ADD COLUMN output jsonb;
