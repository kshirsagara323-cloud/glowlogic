-- 0001_core_catalog.sql
-- Reference + product catalog tables. No personal user data in this file.
-- Do NOT edit after it has been applied; create a new numbered migration instead.

CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive text (emails, ingredient names)
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- fuzzy / partial text search

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ---------- Lookup tables (single source of truth for allowed values) ----------

CREATE TABLE skin_concern (
  code       text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  label      text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE product_category (
  code      text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  label     text NOT NULL,
  is_makeup boolean NOT NULL DEFAULT false
);

-- ---------- Data provenance ----------

CREATE TABLE data_source (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text NOT NULL,
  kind             text NOT NULL CHECK (kind IN
                     ('open_dataset','official_page','manual_curation','public_api','demo')),
  url              text CHECK (url IS NULL OR url ~* '^https?://'),
  license          text,
  license_url      text CHECK (license_url IS NULL OR license_url ~* '^https?://'),
  attribution_text text,
  share_alike      boolean NOT NULL DEFAULT false,  -- true for ODbL-style "share-alike" licences
  date_accessed    date,
  update_frequency text,
  fields_available text[] NOT NULL DEFAULT '{}',
  quality_notes    text,
  limitations      text,
  is_demo          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_run (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_source_id bigint NOT NULL REFERENCES data_source(id),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  stats          jsonb NOT NULL DEFAULT '{}',
  error_message  text
);

-- ---------- Brands ----------

CREATE TABLE brand (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           citext NOT NULL UNIQUE,
  country_code   char(2),
  website_url    text CHECK (website_url IS NULL OR website_url ~* '^https?://'),
  data_source_id bigint REFERENCES data_source(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------- Ingredient intelligence ----------

-- Families let compatibility rules apply to a whole group (e.g. every AHA).
CREATE TABLE ingredient_family (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text NOT NULL,
  description text
);

CREATE TABLE ingredient (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                 text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  inci_name            citext NOT NULL UNIQUE,
  common_name          text,
  family_id            bigint REFERENCES ingredient_family(id),
  functions            text[] NOT NULL DEFAULT '{}',
  summary              text,
  common_uses          text,
  benefits             text,
  drawbacks            text,
  suitable_for         text[] NOT NULL DEFAULT '{}',
  irritation_potential smallint NOT NULL DEFAULT 0 CHECK (irritation_potential BETWEEN 0 AND 3),
  irritation_notes     text,
  typical_frequency    text,
  beginner_guidance    text,
  introduce_slowly     boolean NOT NULL DEFAULT false,
  evidence_level       text CHECK (evidence_level IN
                         ('established','emerging','limited','marketing_claim')),
  is_fragrance_related boolean NOT NULL DEFAULT false,
  is_common_allergen   boolean NOT NULL DEFAULT false,
  is_sunscreen_filter  boolean NOT NULL DEFAULT false,
  review_status        text NOT NULL DEFAULT 'draft'
                         CHECK (review_status IN ('draft','needs_verification','verified')),
  last_reviewed_at     date,
  data_source_id       bigint REFERENCES data_source(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingredient_family_idx ON ingredient(family_id);

CREATE TABLE ingredient_alias (
  alias         citext PRIMARY KEY,
  ingredient_id bigint NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE
);
CREATE INDEX ingredient_alias_ingredient_idx ON ingredient_alias(ingredient_id);

-- Every educational claim should point at a reference a human has checked.
CREATE TABLE ingredient_reference (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ingredient_id     bigint NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  citation          text NOT NULL,
  url               text CHECK (url IS NULL OR url ~* '^https?://'),
  verified_by_human boolean NOT NULL DEFAULT false,
  verified_at       date
);
CREATE INDEX ingredient_reference_ingredient_idx ON ingredient_reference(ingredient_id);

CREATE TABLE ingredient_concern (
  ingredient_id bigint NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  concern_code  text   NOT NULL REFERENCES skin_concern(code),
  relation      text   NOT NULL CHECK (relation IN ('helps','supports','may_worsen')),
  relevance     smallint NOT NULL DEFAULT 1 CHECK (relevance BETWEEN 1 AND 3),
  note          text,
  PRIMARY KEY (ingredient_id, concern_code, relation)
);

-- Rules between families. Stored once per pair with family_a_id <= family_b_id.
CREATE TABLE ingredient_compatibility (
  family_a_id    bigint NOT NULL REFERENCES ingredient_family(id) ON DELETE CASCADE,
  family_b_id    bigint NOT NULL REFERENCES ingredient_family(id) ON DELETE CASCADE,
  level          text NOT NULL CHECK (level IN
                   ('compatible','generally_compatible','use_caution',
                    'potential_irritation','avoid_unless_advised')),
  reason         text NOT NULL,
  suggestion     text,
  base_penalty   smallint NOT NULL DEFAULT 0 CHECK (base_penalty BETWEEN 0 AND 100),
  evidence_level text CHECK (evidence_level IN
                   ('established','emerging','limited','marketing_claim')),
  review_status  text NOT NULL DEFAULT 'draft'
                   CHECK (review_status IN ('draft','needs_verification','verified')),
  PRIMARY KEY (family_a_id, family_b_id),
  CHECK (family_a_id <= family_b_id)
);

-- ---------- Products ----------

CREATE TABLE product (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand_id         bigint NOT NULL REFERENCES brand(id),
  name             text NOT NULL,
  category         text NOT NULL REFERENCES product_category(code),
  subcategory      text,
  description      text,
  ingredients_raw  text,
  size_value       numeric(8,2) CHECK (size_value > 0),
  size_unit        text CHECK (size_unit IN ('ml','g','oz','fl_oz','pcs')),
  price_amount     numeric(10,2) CHECK (price_amount >= 0),
  price_currency   char(3),
  price_observed_on date,
  price_tier       smallint CHECK (price_tier BETWEEN 1 AND 4),
  fragrance_free   boolean,                       -- NULL means "unknown", never guess
  spf              smallint CHECK (spf BETWEEN 0 AND 100),
  finish           text CHECK (finish IN ('matte','natural','satin','dewy','radiant')),
  coverage         text CHECK (coverage IN ('sheer','light','medium','full')),
  product_url      text CHECK (product_url IS NULL OR product_url ~* '^https?://'),
  image_url        text CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  image_license    text,                          -- only show an image if its licence allows it
  barcode          text,
  countries        char(2)[] NOT NULL DEFAULT '{}',
  availability     text NOT NULL DEFAULT 'unknown'
                     CHECK (availability IN ('available','limited','discontinued','unknown')),
  data_source_id   bigint NOT NULL REFERENCES data_source(id),
  source_record_id text,
  status           text NOT NULL DEFAULT 'needs_review'
                     CHECK (status IN ('active','needs_review','outdated','rejected')),
  last_verified_on date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  search_vector    tsvector GENERATED ALWAYS AS (
                     to_tsvector('simple'::regconfig,
                       coalesce(name,'') || ' ' || coalesce(subcategory,''))
                   ) STORED,
  CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  UNIQUE (data_source_id, source_record_id)
);
CREATE UNIQUE INDEX product_dedupe_idx ON product
  (brand_id, (lower(name)), category, ((coalesce(size_value, 0))), ((coalesce(size_unit, ''))));
CREATE INDEX product_category_idx  ON product(category) WHERE status = 'active';
CREATE INDEX product_brand_idx     ON product(brand_id);
CREATE INDEX product_status_idx    ON product(status);
CREATE INDEX product_search_idx    ON product USING gin (search_vector);
CREATE INDEX product_name_trgm_idx ON product USING gin (name gin_trgm_ops);
CREATE INDEX product_countries_idx ON product USING gin (countries);

CREATE TABLE product_skin_type (
  product_id bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  skin_type  text   NOT NULL CHECK (skin_type IN
               ('dry','oily','combination','normal','dehydrated','sensitive')),
  origin     text   NOT NULL CHECK (origin IN ('brand_claim','curated','derived')),
  PRIMARY KEY (product_id, skin_type, origin)
);

CREATE TABLE product_concern (
  product_id   bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  concern_code text   NOT NULL REFERENCES skin_concern(code),
  origin       text   NOT NULL CHECK (origin IN ('brand_claim','curated','derived')),
  PRIMARY KEY (product_id, concern_code, origin)
);
CREATE INDEX product_concern_code_idx ON product_concern(concern_code);

-- raw_name is kept even when we cannot match an ingredient, so nothing is lost.
CREATE TABLE product_ingredient (
  product_id    bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  position      smallint NOT NULL CHECK (position > 0),
  raw_name      text NOT NULL,
  ingredient_id bigint REFERENCES ingredient(id),
  is_key        boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, position)
);
CREATE INDEX product_ingredient_ingredient_idx ON product_ingredient(ingredient_id);

-- Shades: only real, sourced shade data. depth_bin is OUR own 1-10 scale
-- (1 = lightest, 10 = deepest); its exact definition is set in Phase 10.
CREATE TABLE product_shade (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id       bigint NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  shade_name       text NOT NULL,
  shade_code       text,
  depth_bin        smallint CHECK (depth_bin BETWEEN 1 AND 10),
  undertone        text CHECK (undertone IN ('warm','cool','neutral','olive')),
  hex_color        text CHECK (hex_color ~ '^#[0-9A-Fa-f]{6}$'),
  confidence       text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
  data_source_id   bigint NOT NULL REFERENCES data_source(id),
  last_verified_on date,
  UNIQUE (product_id, shade_name)
);

-- ---------- Data quality ----------

CREATE TABLE data_quality_issue (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_run_id bigint REFERENCES import_run(id) ON DELETE SET NULL,
  product_id    bigint REFERENCES product(id) ON DELETE CASCADE,
  issue_type    text NOT NULL CHECK (issue_type IN
                  ('duplicate_product','missing_ingredients','invalid_price','invalid_url',
                   'missing_brand','invalid_category','duplicate_shade','outdated',
                   'unmatched_ingredient')),
  severity      text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','error')),
  details       text,
  detected_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX data_quality_open_idx ON data_quality_issue(issue_type) WHERE resolved_at IS NULL;
