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
  api/order.js             POST /api/order
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
- **Save Changes** button: bulk PATCH to `/api/admin/variants`
- **Edit button** (✏): opens edit modal for article details, variants, photos

### Add Product (3-step wizard)
- Step 1: article code, name, category (datalist), description, base price
  - **Duplicate code check**: compares against existing `ARTICLES` array before submitting,
    shows error toast and red border if duplicate found
- Step 2: add colour/size/qty/price variants
- Step 3: upload photos (compressed client-side before upload)

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
`orders(id, token_id, customer_label, items_json, est_total, created_at, status)`
`banners(id, url, link, sort_order, created_at)`
`categories(id, name, created_at)`
`category_images(id, category, image_url, updated_at)`

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
  Current versions: **admin.html = v=19**, **product.html = v=19**, **s.html (catalogue) = v=22**
  (bump `common.js`, `admin.js`/`catalog.js`, and `styles.css` on the page you changed).
