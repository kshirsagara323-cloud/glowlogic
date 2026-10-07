-- 0006_deleted_account_tombstones.sql
-- After an account is deleted, its login token can stay valid for up to ~1 hour.
-- This table stores ONLY the random user id (no personal data) so the API can refuse
-- to re-create the account from such a token.
CREATE TABLE deleted_account (
  user_id    uuid PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
