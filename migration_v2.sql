-- Migration v2: add banners, category_images tables + new settings
CREATE TABLE IF NOT EXISTS banners (
  id         TEXT PRIMARY KEY,
  image_key  TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  link_url   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS category_images (
  category  TEXT PRIMARY KEY,
  image_key TEXT NOT NULL,
  image_url TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('about_us', 'Your trusted wholesale bag partner.');
INSERT OR IGNORE INTO settings (key, value) VALUES ('instagram_url', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('facebook_url', '');
