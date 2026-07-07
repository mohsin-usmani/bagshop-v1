-- ============================================================
-- Bag Shop — database schema (Cloudflare D1 / SQLite)
-- Run once:  wrangler d1 execute bagshop --file=./schema.sql --remote
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY,
  article_code TEXT NOT NULL,
  name         TEXT,
  category     TEXT NOT NULL,
  description  TEXT,
  base_price   REAL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
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
  items_json     TEXT NOT NULL,
  est_total      REAL,
  created_at     INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'sent'
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ---------- default settings (edit later in the Admin > Settings tab) ----------
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name',          'Your Wholesale Bags'),
  ('owner_phone',        '919999999999'),   -- country code + number, no + or spaces
  ('currency',           'Rs.'),
  ('show_prices',        '1'),
  ('default_link_hours', '4');

-- ---------- sample data so the demo shows something immediately ----------
INSERT OR IGNORE INTO articles (id, article_code, name, category, description, base_price, is_active, created_at) VALUES
  ('a1', 'BAG-1023', 'Ladies Handbag', 'Handbag', 'PU leather, zip closure', 245, 1, 1710000000000),
  ('a2', 'BAG-2011', 'College Backpack', 'Backpack', '30L, padded straps', 320, 1, 1710000001000),
  ('a3', 'BAG-3044', 'Jute Shopping Bag', 'Jute',    'Eco-friendly, printed', 95, 1, 1710000002000);

INSERT OR IGNORE INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES
  ('v1', 'a1', 'Black', 'Large',  245, 40, 1, 1710000000000),
  ('v2', 'a1', 'Tan',   'Large',  245, 35, 1, 1710000000000),
  ('v3', 'a1', 'Maroon','Medium', 230, 50, 1, 1710000000000),
  ('v4', 'a2', 'Blue',  'Medium', 320, 45, 1, 1710000001000),
  ('v5', 'a2', 'Grey',  'Medium', 320, 25, 1, 1710000001000),
  ('v6', 'a3', 'Natural','Free',   95, 200, 1, 1710000002000),
  ('v7', 'a3', 'Green', 'Free',    95, 120, 1, 1710000002000);
