-- npx wrangler d1 execute newgapawn --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS clicks (
  day   TEXT NOT NULL,          -- YYYY-MM-DD, Eastern
  event TEXT NOT NULL,          -- call, directions, offer-cta, offer-sent, ...
  page  TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, page, place)
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS closure_reminders (
  closure  TEXT PRIMARY KEY,    -- start|end|reason
  sent_at  TEXT NOT NULL
);
