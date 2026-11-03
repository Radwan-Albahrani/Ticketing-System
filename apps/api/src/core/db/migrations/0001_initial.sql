CREATE TABLE auth_user (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false,
 image text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE auth_session (
 id text PRIMARY KEY, expires_at timestamp NOT NULL, token text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now(),
 updated_at timestamp NOT NULL DEFAULT now(), ip_address text, user_agent text, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE INDEX auth_session_user_idx ON auth_session(user_id);
CREATE TABLE auth_account (
 id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp,
 scope text, password text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
 UNIQUE(provider_id, account_id)
);
CREATE INDEX auth_account_user_idx ON auth_account(user_id);
CREATE TABLE auth_verification (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE tickets (
 owner_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, id text NOT NULL, subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','classified','failed')),
 classification jsonb, version integer NOT NULL DEFAULT 1 CHECK(version>0), prompt_version text NOT NULL DEFAULT 'jev-1.0',
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), scenario text NOT NULL DEFAULT 'normal', last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,id),
 CHECK((status='classified') = (classification IS NOT NULL)),
 CHECK(classification IS NULL OR (
  jsonb_typeof(classification)='object' AND classification ?& ARRAY['category','priority','summary'] AND
  classification->>'category' IN ('billing','technical','account','other') AND
  classification->>'priority' IN ('low','medium','high') AND jsonb_typeof(classification->'summary')='string' AND
  length(classification->>'summary') BETWEEN 8 AND 300
 ))
);
CREATE INDEX tickets_owner_created_idx ON tickets(owner_id,created_at DESC,id);
CREATE INDEX tickets_classification_idx ON tickets(owner_id,(classification->>'category'),(classification->>'priority'));
CREATE TABLE ticket_events (
 id text PRIMARY KEY, owner_id text NOT NULL, ticket_id text NOT NULL, version integer NOT NULL,
 type text NOT NULL, message text NOT NULL, attempt integer, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,ticket_id) REFERENCES tickets(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX events_ticket_idx ON ticket_events(owner_id,ticket_id,created_at,id);
CREATE TABLE classification_outbox (
 owner_id text NOT NULL, ticket_id text NOT NULL, version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,ticket_id,version),
 FOREIGN KEY(owner_id,ticket_id) REFERENCES tickets(owner_id,id) ON DELETE CASCADE
);
