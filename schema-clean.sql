-- ============================================================
-- Bag Shop — CLEAN schema for a NEW shop (no demo catalogue).
-- Tables + indexes + default settings only. The owner adds their
-- own products/photos/links via the admin panel.
-- Run once against a fresh D1 DB:
--   wrangler d1 execute <db-name> --remote --file=./schema-clean.sql
-- (Use schema.sql instead if you want the Samsonite demo data.)
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id             TEXT PRIMARY KEY,
  article_code   TEXT NOT NULL,
  name           TEXT,
  category       TEXT NOT NULL,
  description    TEXT,
  base_price     REAL,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_new_arrival INTEGER NOT NULL DEFAULT 0,
  related_ids    TEXT,             -- JSON array of article ids for "You may also like"
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS variants (
  id            TEXT PRIMARY KEY,
  article_id    TEXT NOT NULL REFERENCES articles(id),
  color         TEXT,
  size          TEXT,
  price         REAL,             -- NULL => use article.base_price
  available_qty INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_variants_article ON variants(article_id);

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  color      TEXT,
  url        TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_photos_article ON photos(article_id);

CREATE TABLE IF NOT EXISTS access_tokens (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  customer_label TEXT,
  customer_phone TEXT,
  created_at     INTEGER NOT NULL,
  expires_at     INTEGER NOT NULL,
  is_revoked     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON access_tokens(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  token_id       TEXT,
  customer_label TEXT,
  customer_phone TEXT,               -- copied from the link at checkout so the
                                     -- customer's history survives token cleanup
  items_json     TEXT NOT NULL,
  est_total      REAL,
  created_at     INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'sent'
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS banners (
  id            TEXT PRIMARY KEY,
  image_key     TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  link_url      TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  variants_json TEXT
);

CREATE TABLE IF NOT EXISTS category_images (
  category           TEXT PRIMARY KEY,
  image_key          TEXT,
  image_url          TEXT,
  left_image_key     TEXT,
  left_image_url     TEXT,
  right_image_key    TEXT,
  right_image_url    TEXT,
  left_variants_json  TEXT,
  right_variants_json TEXT,
  mobile_source   TEXT NOT NULL DEFAULT 'left',
  tile_source     TEXT NOT NULL DEFAULT 'left'
);

-- ---------- default settings (owner edits these in Admin > Settings) ----------
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name',     'New Shop'),
  ('owner_phone',   ''),
  ('currency',      'Rs.'),
  ('show_prices',   '1'),
  ('about_us',      ''),
  ('instagram_url', ''),
  ('facebook_url',  ''),
  ('tagline',       '');
