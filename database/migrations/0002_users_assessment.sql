-- 0002_users_assessment.sql
-- User-owned data. Every table here cascades on user delete, so
-- "DELETE FROM app_user WHERE id = ..." removes the user's data (privacy requirement).
-- NOTE: photo FILES live in storage, so the API must delete them BEFORE deleting the user.

-- Passwords are never stored here. Authentication is handled by Supabase Auth;
-- app_user.id equals the Supabase auth user id.
CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  disabled_at   timestamptz
);

CREATE TABLE user_profile (
  user_id              uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  age_group            text CHECK (age_group IN ('18_24','25_34','35_44','45_54','55_plus')),
  climate              text CHECK (climate IN ('hot_humid','hot_dry','temperate','cold','varies')),
  sun_exposure         text CHECK (sun_exposure IN ('mostly_indoors','mixed','mostly_outdoors')),
  lifestyle            jsonb NOT NULL DEFAULT '{}',
  budget_tier          smallint CHECK (budget_tier BETWEEN 1 AND 4),
  region_country       char(2) NOT NULL DEFAULT 'IN',
  fragrance_preference text NOT NULL DEFAULT 'no_preference'
                         CHECK (fragrance_preference IN
                           ('no_preference','prefer_fragrance_free','avoid_fragrance')),
  routine_complexity   text NOT NULL DEFAULT 'beginner'
                         CHECK (routine_complexity IN ('minimal','beginner','moderate','advanced')),
  coverage_preference  text CHECK (coverage_preference IN ('sheer','light','medium','full')),
  finish_preference    text CHECK (finish_preference IN ('matte','natural','satin','dewy','radiant')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_restriction (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('allergy','avoid_ingredient','avoid_category')),
  ingredient_id bigint REFERENCES ingredient(id),
  category      text REFERENCES product_category(code),
  free_text     text CHECK (length(free_text) <= 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ingredient_id IS NOT NULL OR category IS NOT NULL OR free_text IS NOT NULL)
);
CREATE INDEX user_restriction_user_idx ON user_restriction(user_id);

-- Append-only record of what the user agreed to, and when.
CREATE TABLE consent_ledger (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  purpose        text NOT NULL CHECK (purpose IN
                   ('terms','privacy_policy','photo_processing','photo_storage','analytics')),
  granted        boolean NOT NULL,
  policy_version text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_ledger_user_idx ON consent_ledger(user_id, purpose, created_at DESC);

CREATE TABLE skin_assessment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  rules_version text,
  answers       jsonb NOT NULL DEFAULT '{}',   -- raw quiz answers, so results can be re-computed
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX skin_assessment_user_idx ON skin_assessment(user_id, created_at DESC);

-- One row per trait per source. A user can be oily + dehydrated + sensitive at once.
-- 'combined' = engine result mixing quiz and (optionally) photo; 'user_override' always wins.
CREATE TABLE skin_profile_trait (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES skin_assessment(id) ON DELETE CASCADE,
  concern_code  text NOT NULL REFERENCES skin_concern(code),
  score         smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  category      text NOT NULL CHECK (category IN ('low','moderate','high')),
  confidence    numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source        text NOT NULL CHECK (source IN ('quiz','photo','combined','user_override')),
  evidence      jsonb NOT NULL DEFAULT '[]',  -- supporting answers / image indicators
  UNIQUE (assessment_id, concern_code, source)
);

CREATE TABLE skin_tone_estimate (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES skin_assessment(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('quiz','photo','combined','user_override')),
  depth_bin     smallint NOT NULL CHECK (depth_bin BETWEEN 1 AND 10),
  undertone     text NOT NULL CHECK (undertone IN ('warm','cool','neutral','olive')),
  ita_angle     numeric(6,2),
  confidence    numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, source)
);

-- Priorities: rank 1 = main concern, 2 = secondary, 3 = long-term goal.
CREATE TABLE skin_concern_priority (
  assessment_id uuid NOT NULL REFERENCES skin_assessment(id) ON DELETE CASCADE,
  rank          smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  concern_code  text NOT NULL REFERENCES skin_concern(code),
  PRIMARY KEY (assessment_id, rank),
  UNIQUE (assessment_id, concern_code)
);

-- Stores metrics only by default. storage_path is set ONLY if the user consented to saving the photo.
CREATE TABLE photo_analysis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES skin_assessment(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  algorithm_version text NOT NULL,
  quality_passed    boolean NOT NULL,
  quality_metrics   jsonb NOT NULL DEFAULT '{}',
  indicators        jsonb NOT NULL DEFAULT '{}',
  storage_path      text,
  retained_until    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photo_analysis_user_idx ON photo_analysis(user_id);

-- Resolved views: user override > combined > quiz > photo.
CREATE VIEW effective_skin_trait AS
SELECT DISTINCT ON (assessment_id, concern_code)
       assessment_id, concern_code, score, category, confidence, source, evidence
FROM skin_profile_trait
ORDER BY assessment_id, concern_code,
         CASE source WHEN 'user_override' THEN 1 WHEN 'combined' THEN 2
                     WHEN 'quiz' THEN 3 ELSE 4 END;

CREATE VIEW effective_skin_tone AS
SELECT DISTINCT ON (assessment_id)
       assessment_id, depth_bin, undertone, ita_angle, confidence, source
FROM skin_tone_estimate
ORDER BY assessment_id,
         CASE source WHEN 'user_override' THEN 1 WHEN 'combined' THEN 2
                     WHEN 'quiz' THEN 3 ELSE 4 END;
