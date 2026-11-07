CREATE TABLE events.online_access (
 occurrence_id uuid PRIMARY KEY,
 url_ciphertext text NOT NULL,
 opens_at timestamptz NOT NULL,
 closes_at timestamptz NOT NULL,
 enabled boolean NOT NULL,
 version integer NOT NULL DEFAULT 1,
 CHECK(closes_at>opens_at)
);
