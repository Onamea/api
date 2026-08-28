CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  identity JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS identities_name_idx ON identities (name);

