-- 0003_routines_recommendations_progress.sql

CREATE TABLE routine (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES skin_assessment(id) ON DELETE SET NULL,
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  kind          text NOT NULL CHECK (kind IN ('morning','night','weekly')),
  complexity    text NOT NULL DEFAULT 'beginner'
                  CHECK (complexity IN ('minimal','beginner','moderate','advanced')),
  is_generated  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX routine_user_idx ON routine(user_id);

CREATE TABLE routine_item (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  routine_id          uuid NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
  step_order          smallint NOT NULL CHECK (step_order > 0),
  step_type           text NOT NULL REFERENCES product_category(code),
  product_id          bigint REFERENCES product(id),
  custom_product_name text CHECK (length(custom_product_name) <= 150),
  frequency           text NOT NULL DEFAULT 'daily' CHECK (frequency IN
                        ('daily','every_other_day','two_three_per_week','weekly','as_needed')),
  notes               text CHECK (length(notes) <= 500),
  CHECK (product_id IS NOT NULL OR custom_product_name IS NOT NULL),
  UNIQUE (routine_id, step_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX routine_item_product_idx ON routine_item(product_id);

-- A run = one execution of the engine. Stores versions + inputs so results are reproducible.
CREATE TABLE recommendation_run (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  assessment_id  uuid NOT NULL REFERENCES skin_assessment(id) ON DELETE CASCADE,
  engine_version text NOT NULL,
  rules_version  text NOT NULL,
  input_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recommendation_run_user_idx ON recommendation_run(user_id, created_at DESC);

CREATE TABLE recommendation (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id          uuid NOT NULL REFERENCES recommendation_run(id) ON DELETE CASCADE,
  product_id      bigint NOT NULL REFERENCES product(id),
  rank            smallint NOT NULL CHECK (rank > 0),
  score           numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),  -- a recommendation score, not a probability
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  warnings        jsonb NOT NULL DEFAULT '[]',
  UNIQUE (run_id, product_id)
);
CREATE INDEX recommendation_product_idx ON recommendation(product_id);

CREATE TABLE recommendation_reason (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recommendation_id bigint NOT NULL REFERENCES recommendation(id) ON DELETE CASCADE,
  code              text NOT NULL,
  message           text NOT NULL,
  weight            numeric(5,2)
);
CREATE INDEX recommendation_reason_rec_idx ON recommendation_reason(recommendation_id);

CREATE TABLE favorite (
  user_id    uuid   NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES product(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX favorite_product_idx ON favorite(product_id);

-- Self-reported ratings (1 = very low, 5 = very high). These show trends, not causes.
CREATE TABLE progress_entry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  entry_date        date NOT NULL DEFAULT current_date,
  oiliness_rating   smallint CHECK (oiliness_rating   BETWEEN 1 AND 5),
  dryness_rating    smallint CHECK (dryness_rating    BETWEEN 1 AND 5),
  hydration_rating  smallint CHECK (hydration_rating  BETWEEN 1 AND 5),
  acne_rating       smallint CHECK (acne_rating       BETWEEN 1 AND 5),
  irritation_rating smallint CHECK (irritation_rating BETWEEN 1 AND 5),
  adherence_pct     smallint CHECK (adherence_pct BETWEEN 0 AND 100),
  notes             text CHECK (length(notes) <= 1000),
  photo_path        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date)
);
