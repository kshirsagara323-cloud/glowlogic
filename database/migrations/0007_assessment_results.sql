-- 0007_assessment_results.sql
-- Store the full engine output so a past report never changes when rules are updated.
ALTER TABLE skin_assessment ADD COLUMN result jsonb;

-- A person may know their depth but not their undertone (or the reverse). Do not fabricate a value.
ALTER TABLE skin_tone_estimate ALTER COLUMN depth_bin DROP NOT NULL;
ALTER TABLE skin_tone_estimate ALTER COLUMN undertone DROP NOT NULL;
ALTER TABLE skin_tone_estimate
  ADD CONSTRAINT skin_tone_estimate_has_value CHECK (depth_bin IS NOT NULL OR undertone IS NOT NULL);
