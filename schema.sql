-- ============================================================
-- Bag Shop — database schema (Cloudflare D1 / SQLite)
-- Run once:  wrangler d1 execute bagshop --file=./schema.sql --remote
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

-- image_key/image_url hold a representative image (the "desktop" crop) for
-- backward-compat consumers; variants_json stores independently-framed crops
-- per placement — {desktop:{key,url,rect}, mobile:{...}, original:{...}} —
-- same pattern as category_images, so desktop and mobile can be framed
-- differently instead of sharing one centred crop.
CREATE TABLE IF NOT EXISTS banners (
  id            TEXT PRIMARY KEY,
  image_key     TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  link_url      TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  variants_json TEXT
);

-- Two photos per category (left/right) so the desktop category header can show
-- them side-by-side with the category name in the gap, Lenskart-style. The
-- mobile header and the homepage tile each show just one of the two — which
-- one is the admin's choice, stored in mobile_source/tile_source ('left'/'right').
-- Legacy image_key/image_url are kept (unused) rather than dropped — SQLite
-- can't cheaply drop columns, and older rows may still have data there.
-- {side}_variants_json holds independently-framed crops of that one uploaded
-- photo for each placement, e.g. {"tile":{"key":..,"url":..},"mobile":{...},
-- "desktop":{...}} — admin can drag/zoom each placement separately in the
-- cropper instead of one shared crop. {side}_image_url/key (legacy, still
-- written by very old rows) is the fallback when a variant isn't set yet.
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

-- ---------- default settings (edit later in the Admin > Settings tab) ----------
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name',          'BagHub Wholesale'),
  ('owner_phone',        '919999999999'),
  ('currency',           'Rs.'),
  ('show_prices',        '1'),
  ('about_us',           'Your trusted wholesale bag partner. Minimum order 40 pcs per article.'),
  ('instagram_url',      ''),
  ('facebook_url',       ''),
  ('tagline',            'WHOLESALE BAGS — QUALITY AT SCALE');

-- ═══════════════════════════════════════════════════════════════════════
-- DEMO CATALOGUE  (sourced from samsonite.in scrape — replace with
-- owner's actual products before going live)
-- ═══════════════════════════════════════════════════════════════════════

-- Clean up old 3-article sample before inserting full catalogue
DELETE FROM photos   WHERE article_id IN ('a1','a2','a3');
DELETE FROM variants WHERE article_id IN ('a1','a2','a3');
DELETE FROM articles WHERE id          IN ('a1','a2','a3');

-- ── Banners ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO banners (id, image_key, image_url, link_url, sort_order, is_active) VALUES
  ('b1', 'banner-ssin-2026',
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Library-Sites-SamsoniteSharedLibrary/default/dwa66d7665/image/images-homepage-revamp/SSIN/2026_Desktop_2400x996_KV3.jpg',
   'Backpacks', 0, 1),
  ('b2', 'banner-backpack-plp',
   'https://www.samsonite.in/on/demandware.static/-/Library-Sites-SamsoniteSharedLibrary/default/dw1184dace/images/category/banner/plp-banner-backpack.jpg',
   'Luggage', 1, 1);

-- ── Category hero images (left photo only by default — admin can add a
--    right photo later for the desktop split-banner look) ─────────────
INSERT OR IGNORE INTO category_images (category, left_image_key, left_image_url) VALUES
  ('Backpacks', 'cat-backpacks',
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dw7659c983/images/evosight-backpack-14/hi-res/153521_1041_hi-res_FRONT34_1.jpg?sw=600&sh=900'),
  ('Luggage', 'cat-luggage',
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dwb10f8083/images/minter-spinner/hi-res/145956-1596_hi-res_FRONT34_1.jpg?sw=600&sh=900'),
  ('Ladies Bags', 'cat-ladies',
   'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80'),
  ('Accessories', 'cat-accessories',
   'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80');

-- ── Articles ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO articles (id, article_code, name, category, description, base_price, is_active, created_at) VALUES
  -- Backpacks
  ('bp1','SS-147137','PRO-DLX 6 Backpack 15.6" 3Vol Exp','Backpacks',
   'Premium business laptop backpack with 3-volume expansion. TSA-approved lock, 32L expandable.',21600,1,1783670400000),
  ('bp2','SS-145892','ALBI N5 Laptop Backpack','Backpacks',
   'Everyday laptop backpack with padded 15L sleeve. Lightweight design, multiple organiser pockets.',6150,1,1783670401000),
  ('bp3','SS-153521','EVOSIGHT Backpack 14.1"','Backpacks',
   'Ultra-lightweight laptop backpack, 18L, ergonomic airmesh back panel, reflective details.',7700,1,1783670402000),
  ('bp4','SS-139460','OPENROAD CHIC 2 Backpack 14.1"','Backpacks',
   'Women laptop backpack with chic design, RFID protection, detachable trolley strap.',13200,1,1783670403000),
  ('bp5','SS-145900','VECTURA Laptop Backpack M','Backpacks',
   'Business backpack with smart pass-through trolley sleeve. 17L, padded tablet pocket.',6270,1,1783670404000),
  ('bp6','SS-158109','SPECTROLITE 4 Laptop Backpack 15.6"','Backpacks',
   'Ultra-lightweight anti-scratch exterior backpack. 27L, premium zippers, USB port.',14500,1,1783670405000),
  -- Luggage
  ('lg1','SS-145956','MINTER Spinner 69/25 EXP','Luggage',
   '4-wheel spinner trolley with expansion. 69L capacity, TSA combination lock, lightweight frame.',21500,1,1783670410000),
  ('lg2','SS-154736','ZENPOD Spinner 55/20','Luggage',
   'Cabin-size hardshell spinner. Polycarbonate shell, ultra-lightweight, double spinner wheels.',19100,1,1783670411000),
  ('lg3','SS-112369','HARTLAN Spinner 75/28','Luggage',
   'Large hardshell expandable spinner. 4 dual-spinner wheels, integrated TSA lock.',14880,1,1783670412000),
  ('lg4','SS-162287','QUANTHOM Spinner 76/28 EXP','Luggage',
   'Premium aluminium-frame 4-wheel spinner. Ultra-secure TSA lock, expandable, 100L.',25800,1,1783670413000),
  ('lg5','SS-155619','MODUS Spinner 55/20 EXP','Luggage',
   'Expandable cabin spinner with front pocket. 40L + 10L expansion, TSA lock.',11840,1,1783670414000),
  -- Ladies Bags
  ('lb1','BAG-L001','Ladies PU Leather Tote Bag','Ladies Bags',
   'Premium PU leather tote with zip closure. Shoulder strap + top handle. 35×30×15 cm.',2450,1,1783670420000),
  ('lb2','BAG-L002','Women Crossbody Sling Bag','Ladies Bags',
   'Compact crossbody sling bag, adjustable strap. Zip + magnetic closure, multiple pockets.',1250,1,1783670421000),
  ('lb3','BAG-L003','Women Canvas Shopper Tote','Ladies Bags',
   'Large canvas shopper tote, waterproof lining, inner zip pocket. Fits A4 documents.',1850,1,1783670422000),
  -- Accessories
  ('ac1','ACC-001','Travel Packing Cube Set (3 pcs)','Accessories',
   '3-piece compression packing cube set. Water-resistant ripstop nylon. S/M/L sizes.',650,1,1783670430000),
  ('ac2','ACC-002','RFID Blocking Passport Wallet','Accessories',
   'RFID-blocking passport holder. 6 card slots, document pocket, PU leather.',850,1,1783670431000);

-- ── Variants ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES
  -- PRO-DLX 6
  ('v-bp1-bk','bp1','Black',  NULL,21600,48,1,1783670400000),
  ('v-bp1-nv','bp1','Navy',   NULL,21600,36,1,1783670400000),
  -- ALBI N5
  ('v-bp2-bg','bp2','Black/Grey',NULL,6150,60,1,1783670401000),
  ('v-bp2-bk','bp2','Black',     NULL,6150,45,1,1783670401000),
  -- EVOSIGHT
  ('v-bp3-bk','bp3','Black',      NULL,7700,55,1,1783670402000),
  ('v-bp3-gr','bp3','Bright Lime',NULL,7700,30,1,1783670402000),
  -- OPENROAD CHIC 2
  ('v-bp4-bk','bp4','Black',     NULL,13200,40,1,1783670403000),
  ('v-bp4-pk','bp4','Dusty Pink',NULL,13200,35,1,1783670403000),
  -- VECTURA
  ('v-bp5-bk','bp5','Black',NULL,6270,72,1,1783670404000),
  ('v-bp5-bl','bp5','Blue', NULL,6270,48,1,1783670404000),
  -- SPECTROLITE 4
  ('v-bp6-mb','bp6','Midnight Blue',NULL,14500,40,1,1783670405000),
  ('v-bp6-bk','bp6','Black',        NULL,14500,55,1,1783670405000),
  -- MINTER Spinner
  ('v-lg1-nv','lg1','Navy', '69/25',21500,36,1,1783670410000),
  ('v-lg1-bk','lg1','Black','69/25',21500,48,1,1783670410000),
  ('v-lg1-rd','lg1','Red',  '69/25',21500,24,1,1783670410000),
  -- ZENPOD Spinner
  ('v-lg2-bk','lg2','Black', '55/20',19100,48,1,1783670411000),
  ('v-lg2-sv','lg2','Silver','55/20',19100,36,1,1783670411000),
  -- HARTLAN Spinner
  ('v-lg3-nv','lg3','Navy', '75/28',14880,30,1,1783670412000),
  ('v-lg3-bk','lg3','Black','75/28',14880,42,1,1783670412000),
  -- QUANTHOM
  ('v-lg4-sv','lg4','Silver','76/28',25800,24,1,1783670413000),
  ('v-lg4-bk','lg4','Black', '76/28',25800,30,1,1783670413000),
  -- MODUS Spinner
  ('v-lg5-gb','lg5','Grey Blue','55/20',11840,36,1,1783670414000),
  ('v-lg5-bk','lg5','Black',   '55/20',11840,48,1,1783670414000),
  -- Ladies Tote
  ('v-lb1-bk','lb1','Black',NULL,2450,60,1,1783670420000),
  ('v-lb1-tn','lb1','Tan',  NULL,2450,48,1,1783670420000),
  ('v-lb1-br','lb1','Brown',NULL,2450,36,1,1783670420000),
  -- Crossbody
  ('v-lb2-bk','lb2','Black',NULL,1250,80,1,1783670421000),
  ('v-lb2-rd','lb2','Red',  NULL,1250,50,1,1783670421000),
  ('v-lb2-bl','lb2','Blush',NULL,1250,40,1,1783670421000),
  -- Shopper Tote
  ('v-lb3-bk','lb3','Black',NULL,1850,60,1,1783670422000),
  ('v-lb3-bg','lb3','Beige',NULL,1850,45,1,1783670422000),
  ('v-lb3-nd','lb3','Nude', NULL,1850,30,1,1783670422000),
  -- Packing Cubes
  ('v-ac1-bk','ac1','Black',NULL,650,120,1,1783670430000),
  ('v-ac1-nv','ac1','Navy', NULL,650,80,1,1783670430000),
  -- Passport Wallet
  ('v-ac2-bk','ac2','Black',NULL,850,100,1,1783670431000),
  ('v-ac2-br','ac2','Brown',NULL,850,60,1,1783670431000);

-- ── Photos (Samsonite CDN for branded products; Unsplash for others) ──
-- NOTE: Replace these with photos uploaded via Admin > Articles > Photos
--       once owner's own product shots are available.
INSERT OR IGNORE INTO photos (id, article_id, color, url, sort_order) VALUES
  -- PRO-DLX 6 (front shot)
  ('ph-bp1-1','bp1',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dweb4d6d70/images/pro-dlx-6-backpack-3-vol-exp-15/hi-res/147137_1041_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- ALBI N5
  ('ph-bp2-1','bp2',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dwefc2e316/images/albi-n5-laptop-backpack-in/hi-res/145892_1062_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- EVOSIGHT
  ('ph-bp3-1','bp3',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dw7659c983/images/evosight-backpack-14/hi-res/153521_1041_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- OPENROAD CHIC 2
  ('ph-bp4-1','bp4',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dw125a3a7f/images/openroad-chic-2-backpack/hi-res/139460_1041_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- VECTURA
  ('ph-bp5-1','bp5',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dw71135c45/images/vectura-laptop-backpack-m-in/hi-res/145900_1041_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- SPECTROLITE 4
  ('ph-bp6-1','bp6',NULL,
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dwd30217ab/images/spectrolite-4-lpt-backpack-15-6/hi-res/158109-9930_hi-res_FRONT34_1.jpg?sw=600&sh=900',0),
  -- MINTER Spinner (Navy variant — main shot)
  ('ph-lg1-1','lg1','Navy',
   'https://www.samsonite.in/dw/image/v2/AAWQ_PRD/on/demandware.static/-/Sites-Samsonite/default/dwb10f8083/images/minter-spinner/hi-res/145956-1596_hi-res_FRONT34_1.jpg?sw=600&sh=900',0);
  -- Luggage lg2–lg5 and Ladies/Accessories use smart Unsplash placeholders (catalog.js)
