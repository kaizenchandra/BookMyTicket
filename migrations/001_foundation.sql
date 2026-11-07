CREATE SCHEMA identity;
CREATE SCHEMA profiles;
CREATE SCHEMA providers;
CREATE SCHEMA catalog;
CREATE SCHEMA inventory;
CREATE SCHEMA payments;
CREATE SCHEMA reporting;
CREATE TABLE identity.accounts (
 id uuid PRIMARY KEY, contact text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity.sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES identity.accounts(id), expires_at timestamptz NOT NULL, mfa_verified boolean NOT NULL DEFAULT false
);
CREATE TABLE identity.challenges (
 id uuid PRIMARY KEY, contact text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, consumed boolean NOT NULL DEFAULT false, delivery_state text NOT NULL CHECK(delivery_state IN ('pending','accepted','failed','unknown')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_contact_time ON identity.challenges(contact,created_at);
CREATE TABLE identity.grants (
 account_id uuid NOT NULL REFERENCES identity.accounts(id), permission text NOT NULL, scope text NOT NULL, PRIMARY KEY(account_id,permission,scope)
);
CREATE TABLE profiles.preferences (
 account_id uuid PRIMARY KEY REFERENCES identity.accounts(id), theme text NOT NULL DEFAULT 'LIGHT' CHECK(theme IN ('LIGHT','DARK')), city text, name text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1
);
CREATE TABLE providers.organizations (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES identity.accounts(id), name text NOT NULL, kind text NOT NULL CHECK(kind IN ('cinema','event','sports')), state text NOT NULL DEFAULT 'draft', version integer NOT NULL DEFAULT 1, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE providers.memberships (
 organization_id uuid NOT NULL REFERENCES providers.organizations(id), account_id uuid NOT NULL REFERENCES identity.accounts(id), role text NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(organization_id,account_id)
);
CREATE TABLE catalog.listings (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES providers.organizations(id), title text NOT NULL, kind text NOT NULL CHECK(kind IN ('movie','event','sports')), city text NOT NULL, description text NOT NULL, poster_url text, metadata jsonb NOT NULL DEFAULT '{}', state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','submitted','changes_requested','approved','published','suspended','archived')), version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_catalog ON catalog.listings(city,kind,id) WHERE state='published';
CREATE TABLE inventory.occurrences (
 id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES catalog.listings(id), organization_id uuid NOT NULL REFERENCES providers.organizations(id), venue_name text NOT NULL, time_zone text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, sales_open timestamptz NOT NULL, sales_close timestamptz NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','paused','cancelled','closed')), version integer NOT NULL DEFAULT 1, CHECK(ends_at>starts_at), CHECK(sales_close>sales_open), CHECK(sales_close<=starts_at)
);
CREATE TABLE inventory.reservations (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES identity.accounts(id), idempotency_key text NOT NULL, fingerprint text NOT NULL, state text NOT NULL CHECK(state IN ('active','released','expired','consumed')), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1, UNIQUE(owner_id,idempotency_key)
);
CREATE TABLE inventory.resources (
 occurrence_id uuid NOT NULL REFERENCES inventory.occurrences(id), id text NOT NULL, kind text NOT NULL CHECK(kind IN ('seat','pool')), label text NOT NULL, capacity integer NOT NULL CHECK(capacity>0), sold integer NOT NULL DEFAULT 0 CHECK(sold>=0), price_paise integer NOT NULL CHECK(price_paise>=0), version integer NOT NULL DEFAULT 1, PRIMARY KEY(occurrence_id,id), CHECK(sold<=capacity), CHECK(kind<>'seat' OR capacity=1)
);
CREATE TABLE inventory.reservation_items (
 reservation_id uuid NOT NULL REFERENCES inventory.reservations(id), occurrence_id uuid NOT NULL, resource_id text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price_paise integer NOT NULL CHECK(unit_price_paise>=0), PRIMARY KEY(reservation_id,occurrence_id,resource_id), FOREIGN KEY(occurrence_id,resource_id) REFERENCES inventory.resources(occurrence_id,id)
);
CREATE INDEX reservation_resource ON inventory.reservation_items(occurrence_id,resource_id);
CREATE TABLE inventory.seat_ownership (
 occurrence_id uuid NOT NULL, resource_id text NOT NULL, reservation_id uuid REFERENCES inventory.reservations(id), version integer NOT NULL DEFAULT 1, PRIMARY KEY(occurrence_id,resource_id), FOREIGN KEY(occurrence_id,resource_id) REFERENCES inventory.resources(occurrence_id,id)
);
CREATE TABLE payments.webhook_events (
 provider_event_id text PRIMARY KEY, body jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE reporting.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, action text NOT NULL, target text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reporting.outbox (
 id uuid PRIMARY KEY, type text NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz, state text NOT NULL DEFAULT 'pending'
);
