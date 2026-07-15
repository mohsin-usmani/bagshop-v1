# CLAUDE.md — Wholesale Bag Shop

> This file is the project's memory. Read it fully before doing anything.
> It captures every decision made so far so you can continue without the original chat.

## What this is

A private, time-limited online catalogue for a **wholesale bag seller** (bulk buyers are shop
owners, ~40–50 pcs per article). Customers open a personal link, browse live stock with photos
and **prices**, build a cart, and send a structured order to the owner's **WhatsApp**. All
negotiation, billing, and payment continue on WhatsApp exactly as before. Max ~100 low-frequency
customers. Must run at **₹0/month**.

## Current status

- **Phase 1 (Setup & deploy) — COMPLETE.** Deployed to Cloudflare Pages at `bagshop-1p8.pages.dev`.
  D1 database created, schema applied, ~70 articles loaded with real data. CF Access configured.
- **Phase 2 (Load real data) — COMPLETE.** Owner has added ~70 real products via admin panel.
- Next up is **Phase 3 (Pilot)** — share links with 3–5 customers and test the order flow.

## Locked decisions (do not re-litigate without asking the user)

1. **Stack: Cloudflare-native, free tier.** Pages + Pages Functions + D1 + R2 + CF Access.
2. **Show prices in the catalogue: YES.**
3. **No WhatsApp Business API.** Use free `wa.me` deep links.
4. **Customers do not log in.** Secret expiring magic link `/s/<token>`.
5. **Single-tenant** (one shop).
6. **Payments & fulfilment stay on WhatsApp.**
7. **Vanilla HTML/CSS/JS frontend, no build step.**
8. **CF Access team:** `little-credit-ba79`. App: `bagshop-1p8.pages.dev`.

## Architecture / file map

```
schema.sql                 D1 tables + sample data (sample rows already deleted, real data loaded)
wrangler.toml              Cloudflare bindings — D1 database_id already filled in

public/
  index.html               landing
  s.html + assets/catalog.js   CUSTOMER catalogue
  admin.html + assets/admin.js OWNER admin panel
  product.html + assets/product.js  product detail page
  assets/styles.css        shared styling (teal #0E6B57 / amber #E0A03C / ink #12332B)
  assets/common.js         fetch helper (with 20s AbortController timeout), toast, image compression
  _headers                 Cache-Control: no-store on /admin.html

functions/
  api/_util.js             shared: json(), sha256hex(), checkAdmin(), isAdmin(), validToken()
  api/catalog.js           GET /api/catalog?token=…
  api/order.js             POST /api/order  (stores customer_phone + item snapshot on the order)
  api/history.js           GET /api/history?token=… → customer's own past orders (by phone)
  api/img/[[path]].js      GET /api/img/<key> → R2 stream
  api/admin/_middleware.js  auth gate for ALL /api/admin/* routes (runs before every endpoint)
  api/admin/articles.js    GET/POST/PATCH/DELETE articles (GET runs 3 D1 queries in parallel)
  api/admin/variants.js    POST add; PATCH bulk stock/price; DELETE
  api/admin/photos.js      POST upload → R2; DELETE
  api/admin/tokens.js      GET list; POST create; PATCH revoke
  api/admin/orders.js      GET order log
  api/admin/settings.js    GET/POST shop settings
  api/admin/login-bounce.js  GET → 302 /admin.html (CF Access login trigger — see Auth section)
  api/admin/status.js      GET → {auth, articles_in_db, variants_in_db} (diagnostic)
  api/admin/banners.js     banner management
  api/admin/categories.js  category management
  api/admin/category-images.js  category image management
  s/[token].js             /s/<token> → 302 /s.html?t=<token>
```

## CF Access configuration (CRITICAL — do not change)

CF Access (Zero Trust → Access → Applications → bagshop-admin) protects:
- `bagshop-1p8.pages.dev` / `admin*`    ← covers /admin AND /admin.html
- `bagshop-1p8.pages.dev` / `api/admin/*`

**Why both:** admin.html is served at `/admin` (Clean URL) which is different from `/admin.html`.
Without `admin*`, CF Access only intercepts `/admin.html` and the clean URL loads without login.

**Login flow for Sign In button:**
`doSignIn()` → navigates to `/api/admin/login-bounce` → CF Access intercepts (no session) →
shows CF Access login page → user authenticates → CF Access redirects back to login-bounce →
login-bounce returns 302 to `/admin.html` → admin loads with valid session.

**Why login-bounce instead of direct CF Access URL:**
Going to `https://little-credit-ba79.cloudflareaccess.com/cdn-cgi/access/login/<domain>` requires
a `kid` (app AUD) parameter that we can't reliably get client-side. login-bounce sidesteps this
by navigating to a CF-Access-protected URL directly, letting CF Access handle the redirect.

## Auth architecture

### Backend (`functions/api/_util.js`)
`checkAdmin(context)` returns `{ok, reason, email}`:
1. If `DEV=1` env → always OK (local dev only, never in production)
2. Check `Cf-Access-Authenticated-User-Email` header (injected by CF Access for protected paths) → preferred
3. Fall back to `CF_Authorization` JWT cookie (set by CF Access at login)
   - Checks email is present in JWT payload
   - **Does NOT check JWT expiry** — CF Access manages session lifecycle; our exp check was wrongly
     rejecting valid sessions when CF Access hadn't yet expired them
   - Checks email is in `ALLOWED_EMAILS` env var (comma-separated)
4. `isAdmin(context)` is a boolean alias kept for backward compat (individual endpoints still call it)

### Middleware (`functions/api/admin/_middleware.js`)
Runs before ALL `/api/admin/*` endpoints. Returns `{error:"auth", reason, email}` with 401 if
auth fails, otherwise calls `context.next()`. Individual `isAdmin()` checks in each endpoint file
are now redundant but harmless.

### Frontend (`public/assets/common.js` → `api()` function)
- 20-second AbortController timeout on every fetch
- If fetch **throws** (CORS failure from CF Access cross-origin redirect): dispatches `apiauthfail` event
- If fetch returns **HTML** (CF Access login page served same-origin): dispatches `apiauthfail` event
- If fetch **times out** (AbortError): returns `{data: null}` — NOT treated as auth failure

### Frontend (`public/assets/admin.js`)
Key globals: `AUTH_FAIL_FIRED` flag prevents authFail racing when multiple API calls fail simultaneously.

`authFail(data)`:
- If `AUTH_FAIL_FIRED` already true → return (deduplication)
- Sets `AUTH_FAIL_FIRED = true`
- reason `cf_redirect` AND first load (no `?_cf` in URL) → navigate to `/admin.html?_cf=1`
  (gives CF Access one chance to intercept the reload)
- All other reasons OR second load → replace `document.body.innerHTML` with sign-in screen
- Sign-in screen has a "Sign In" button that calls `doSignIn()`

`doSignIn()`: `window.location.href = '/api/admin/login-bounce'`

`loadAll()`:
- Resets `AUTH_FAIL_FIRED = false`
- Runs `loadSettings()` and `loadArticles()` in parallel
- If either throws → `authFail({error:"auth", reason:"no_session"})`
- If `AUTH_FAIL_FIRED` after both complete → skip secondary loads (loadLinks, loadOrders, etc.)

`loadArticles()` timeout handling:
- `artRes.data === null` (timeout or unexpected) → shows "Took too long — Retry" button in stockTable
  (NOT an authFail — user may be logged in but D1 had a cold start)
- `artRes.data.error` → authFail

## Admin panel features implemented

### Go-live rule (IMPORTANT)
A product is visible to customers when **at least one colour/size has its "Live" box
ticked AND has qty > 0**. There is **no** article-level on/off switch — the old article
`is_active` "Active" toggle (edit modal) and "Show to customers" (wizard) were removed.
The server (`catalog.js`) no longer filters on `articles.is_active`; visibility is driven
solely by active variants with stock. `articles.is_active` is kept in the schema but is
always written as `1`. `stockLiveInfo()` (admin.js) mirrors this rule for the status badges.

- **New products/colours default to NOT live** (variants insert `is_active = 0` on both
  `variants` POST and `articles` POST). The admin publishes with the **Live** switch.
- **Live switch (two equivalent controls):** the per-colour "Live" checkbox in Stock
  (`toggleStockLive`, auto-saves on toggle) and the master "Live" toggle in the Add-Product
  wizard status bar (`wzSetLive`, flips every colour of the product at once).

### Stock tab
- Table: article code, name, colour, size, price (editable), qty (editable), live toggle, Edit button
- **Search** by code, name, or category (live filter)
- **Sort by**: Newest first / Oldest first / A→Z / Z→A / By category
- **Per-row Save**: editing a row's price or qty reveals a Save button next to the qty box
  (`stockRowDirty`/`saveRow`) that PATCHes just that one variant. The old top-of-tab bulk
  "Save changes" button and `saveStock()` were removed.
- **Edit button** (✏): opens edit modal for article details, variants, photos

### Add Product (4-step wizard)
- Step 1: article code, name, category (datalist), description, base price
  - **Duplicate code check**: compares against existing `ARTICLES` array before submitting,
    shows error toast and red border if duplicate found
- Step 2: add colour/size/qty/price variants
- Step 3: "You may also like" — same picker as the Edit modal (`relatedEditorHTML`/`relSearch`/
  `addRelated`/`removeRelated`, all shared code), reused here since the article already exists
  in the DB by this point. Has a Skip button — both Skip and Next just move on to photos,
  saving whatever picks were made either way (nothing to discard, it's optional either way).
- Step 4: upload photos (compressed client-side before upload)

### Other tabs
- Categories: create/rename/delete (rename cascades to all articles)
- Banners: homepage slider images with category/article code links; category tile images
- Customer Links: create expiring magic links, copy/WhatsApp share, revoke
- Orders: log of all orders submitted via wa.me flow
- Settings: shop name, owner WhatsApp, currency, show_prices, about, Instagram, Facebook

## D1 performance note

On Cloudflare free tier, D1 has cold starts (~3–8 seconds after inactivity). The articles GET
endpoint runs **3 queries in parallel** (articles, variants, photos) via `Promise.all` to minimize
this. First load after inactivity may take 5–10 seconds; subsequent loads are fast (<1s).
The 20s timeout in `api()` covers the worst-case cold start.

## Data model (D1 / SQLite)

`settings(key, value)`
`articles(id, article_code, name, category, description, base_price, is_active, is_new_arrival, created_at)`
`variants(id, article_id, color, size, price, available_qty, is_active, updated_at)`
`photos(id, article_id, color, url, sort_order)`
`access_tokens(id, token_hash, customer_label, customer_phone, created_at, expires_at, is_revoked)`
`orders(id, token_id, customer_label, customer_phone, items_json, est_total, created_at, status)`
  - `customer_phone` copied from the link at checkout so a customer's history is preserved even
    if the link is later revoked. `items_json` stores an enriched snapshot (code/name/colour/size/qty/price).
  - NOTE: access_tokens are **no longer auto-purged** (the old 7-day cleanup was removed) so past
    customers persist for the create-link autocomplete. Links still expire via `expires_at`; expiry
    can be shifted by ± hours from the admin Customer Links tab (tokens PATCH `{id, delta_hours}`).
  - Migration for existing DBs: `ALTER TABLE orders ADD COLUMN customer_phone TEXT;`
`banners(id, url, link, sort_order, created_at)`
`categories(id, name, created_at)`
`category_images(category PK, image_key, image_url [legacy, unused], left_image_key, left_image_url,
  right_image_key, right_image_url, left_variants_json, right_variants_json, mobile_source, tile_source)`
  - Two photos per category (Left/Right). Desktop category page shows both side by side with the
    category name in the gap (`.cat-hero-split`); mobile shows one photo only — `mobile_source`
    ('left'/'right') picks which — with a small label over a light bottom gradient (`.cat-hero-mobile`).
    The homepage tile similarly uses whichever side `tile_source` points to. If only one side is
    uploaded, falls back to the pre-existing single-photo `.cat-hero` look (image + big centred text).
  - **Desktop mid gap:** `.cat-hero-split-mid` (Lenskart-style — `min-width` 390px) is a plain white
    card showing the shop's uploaded logo (`shop.logo_url`, ~30px tall), a thin vertical divider
    (`.cat-hero-split-divider`, only rendered when a logo is set), then the category name — all in a
    row (`flex-direction:row`), spaced by the container's `gap` so the divider sits evenly between
    logo and name (Lenskart "lenskart | POP MART" lockup style). The name uses the self-hosted **Anton**
    display font (`/assets/fonts/Anton-Regular.woff2`, `@font-face` in styles.css, 32px, letter-spacing
    3px) to match a bold block-letter logotype look (e.g. Lenskart's "POP MART" banner) — matches the
    project's existing pattern of self-hosting fonts (GT-America, Gotham) rather than pulling from
    Google Fonts CDN. The two side photos are always equal width (`flex:1` on both `.cat-hero-split-photo`)
    so the layout stays symmetric/centred at any viewport width — widening the mid card never unbalances
    it, just shrinks both photos equally. **If the mid card's `min-width` changes again, also update
    the "desktop" ratio in `CAT_IMG_TARGETS` (admin.js)** — it's a guide for the crop tool showing the
    actual on-page shape of each side photo, computed from the mid width vs. a representative desktop
    viewport; currently 2:1 for the 390px mid width (was 16:9 at 520px, was 2:1 at 260px, was ~2.2:1
    at 210px — history: 210 → 260 → 520 (too wide, reverted) → 390, i.e. 1.5× the 260px version).
  - **Mobile loops both photos** (`.cat-hero-mob-track` / `.cat-hero-mob-slide` / `.cat-hero-mob-dots`)
    instead of a single static side — same fade-crossfade + swipe + dot mechanics as the homepage
    banner (`startCatHeroLoop`/`stopCatHeroLoop`/`initCatHeroSwipe`/`setCatHeroSlide` in catalog.js),
    each photo using its own `mobile` crop (`left_mobile_url`/`right_mobile_url` from catalog.js).
    Because of this, `mobile_source` is no longer read when building the customer catalogue response
    (still writable via the category-images PATCH endpoint, and the DB column is kept, but nothing
    reads it) — the admin's "Mobile header shows" Left/Right picker was removed since it no longer
    does anything.
  - **Per-target independent framing:** each of the two uploaded photos can be cropped differently
    for each of its 3 placements (Desktop header 2:1, Mobile header 3:2, Homepage tile 3:4) instead of
    one shared centred crop. `{side}_variants_json` stores `{tile:{key,url}, mobile:{...}, desktop:{...},
    original:{...}}`. Admin UI: Banners tab → Category Images → Upload/Replace opens the cropper in
    `perTargetAdjust` mode (`openCropper` in admin.js) — tabs (`CAT_IMG_TARGETS`) switch which
    placement's own drag/zoom state is being edited; "Save all" generates and uploads all 3 crops
    plus the unmodified `original` in one go (`openCatImgCropper`, one POST per target with a
    `target` field). Each variant also stores `rect` (the source region as fractions of the original,
    computed from the pan/zoom used) so **Adjust** on an existing photo reopens each tab showing the
    exact framing chosen last time (`stateFromRect` in `openCropper`) instead of resetting to a
    centred default — without `rect` the reopened cropper looked like the photo had never been
    cropped. Thumbnails in the admin list are small (120px). `adjustCatImg` fetches the saved
    `original` variant, or falls back to the best existing crop (with no `rect` restore, since a
    fallback crop's coordinates don't map back to the true original) for photos uploaded before
    `original` was kept. `{side}_image_url/key` (legacy) is kept as a fallback only — new uploads
    write solely into `{side}_variants_json`. Frontend (`functions/api/catalog.js`) resolves each
    placement from variants first, legacy url second.
  - **`openCropper` supports two-finger pinch-zoom** (shared by category photos, banners, and product
    photos — it's one function). Tracks all active pointers in a `Map`; with 2 down it zooms anchored
    to the live midpoint between them each move (so panning the midpoint while pinching also pans the
    image) instead of the old single-pointer-only logic, which made a second finger's events fight the
    first's and produced a jumpy, unusable pinch on mobile. Lifting one finger mid-pinch resumes
    single-finger pan from that finger's current position (not its stale down-position) so there's no
    jump. `setPointerCapture` is wrapped in try/catch (matching `releasePointerCapture`) since it can
    throw for pointer IDs the browser doesn't consider active.
  - Migration note: the original `image_key`/`image_url` columns had `NOT NULL` — SQLite can't drop
    that via `ALTER TABLE`, so if this table is ever migrated again, rebuild it (`CREATE TABLE ... new`
    → `INSERT ... SELECT` → `DROP` → `RENAME`) rather than just adding columns, or `INSERT ... ON
    CONFLICT DO UPDATE` will fail with `NOT NULL constraint failed: category_images.image_key`.
    `{side}_variants_json` columns were added later via plain `ALTER TABLE ... ADD COLUMN` (nullable,
    no default) — safe, no rebuild needed.

## Cloudflare environment variables (Pages → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DEV` | `0` (production) |
| `ALLOWED_EMAILS` | `1mohsinusmani@gmail.com,mauhidusmani@gmail.com,ulhaqinzamam61@gmail.com` (comma-separated admins) |

Bindings: `DB` → D1 database `bagshop`, `BUCKET` → R2 bucket `bagshop-photos`

## Roadmap

Phase 0 Scaffold ✅ · Phase 1 Setup & deploy ✅ · Phase 2 Load real data ✅ ·
Phase 3 Pilot with 3–5 customers (next) · Phase 4 Go live on domain ·
Phase 5 Enhancements (low-stock badges, hide out-of-stock, reorder-last-order,
duplicate-article, price tiers, analytics)

## Conventions & guardrails

- Stay **free-tier only**. No paid add-ons, no heavy dependencies, no build step.
- **Security:** Keep `DEV=0` in production. Never commit secrets.
- Tokens stored **hashed** — never store or log raw tokens.
- **No build step** — vanilla HTML/CSS/JS only.
- Deploy command: `wrangler pages deploy public --project-name bagshop`
- After deploy, bump the `?v=N` version on script **and stylesheet** tags to bust CDN cache.
  Current versions: **admin.html = v=49 (styles v=62)**, **product.html = v=42 (styles v=62)**, **s.html (catalogue) = v=49 (styles v=62)**
  NOTE: `admin.js`'s `jq(s)` RETURNS THE VALUE ALREADY WRAPPED IN SINGLE QUOTES (`'s'`), unlike
  `product.js`/`catalog.js` `jq()` which do not. In admin.js write `onclick="fn(' + jq(id) + ')"`
  (no extra quotes) — adding your own `\'...\'` double-wraps and breaks the handler.
  (bump `common.js`, `admin.js`/`catalog.js`, and `styles.css` on the page you changed).
