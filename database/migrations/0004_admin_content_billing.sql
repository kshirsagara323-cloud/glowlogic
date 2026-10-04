-- 0004_admin_content_billing.sql

-- Permission-based admin access (no "every admin can do everything").
CREATE TABLE admin_permission (
  code        text PRIMARY KEY CHECK (code ~ '^[a-z_]+\.[a-z_]+$'),
  description text NOT NULL
);
CREATE TABLE admin_role (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);
CREATE TABLE admin_role_permission (
  role_id         bigint NOT NULL REFERENCES admin_role(id) ON DELETE CASCADE,
  permission_code text   NOT NULL REFERENCES admin_permission(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);
CREATE TABLE admin_user (
  user_id    uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  role_id    bigint NOT NULL REFERENCES admin_role(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only. actor_user_id deliberately has NO foreign key, so deleting an account
-- never needs to modify audit rows (it just leaves an anonymous id).
CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log(created_at DESC);
CREATE INDEX audit_log_entity_idx  ON audit_log(entity_type, entity_id);

CREATE OR REPLACE FUNCTION forbid_audit_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_changes();

CREATE TABLE feedback (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid REFERENCES app_user(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('general','bug','report_content','data_error')),
  message    text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
  product_id bigint REFERENCES product(id) ON DELETE SET NULL,
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_status_idx ON feedback(status, created_at DESC);

CREATE TABLE educational_article (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text NOT NULL,
  summary_simple   text NOT NULL,
  body_detailed    text,
  examples         text,
  safety_notes     text,
  topics           text[] NOT NULL DEFAULT '{}',
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  review_status    text NOT NULL DEFAULT 'draft'
                     CHECK (review_status IN ('draft','needs_verification','verified')),
  last_reviewed_at date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX educational_article_topics_idx ON educational_article USING gin (topics);

-- Powers the personalised "Learn for you" feed.
CREATE TABLE article_concern (
  article_id   bigint NOT NULL REFERENCES educational_article(id) ON DELETE CASCADE,
  concern_code text   NOT NULL REFERENCES skin_concern(code),
  PRIMARY KEY (article_id, concern_code)
);

CREATE TABLE article_reference (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id        bigint NOT NULL REFERENCES educational_article(id) ON DELETE CASCADE,
  citation          text NOT NULL,
  url               text CHECK (url IS NULL OR url ~* '^https?://'),
  verified_by_human boolean NOT NULL DEFAULT false
);

-- Optional premium tier. Phase 1 decision: TEST MODE ONLY for the demo.
CREATE TABLE subscription (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES app_user(id) ON DELETE CASCADE,
  plan                     text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','trialing','past_due','canceled')),
  provider                 text NOT NULL DEFAULT 'none' CHECK (provider IN ('none','test','razorpay','stripe')),
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Privacy-conscious analytics: deliberately NO user id and no session id.
CREATE TABLE analytics_event (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name  text NOT NULL CHECK (length(event_name) <= 60),
  occurred_on date NOT NULL DEFAULT current_date,
  props       jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_event_idx ON analytics_event(event_name, occurred_on);
