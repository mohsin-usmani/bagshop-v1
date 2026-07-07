# CLAUDE.md — Wholesale Bag Shop

> This file is the project's memory. Read it fully before doing anything.
> It captures every decision made so far so you can continue without the original chat.

## What this is

A private, time-limited online catalogue for a **wholesale bag seller** (bulk buyers are shop
owners, ~40–50 pcs per article). Customers open a personal link, browse live stock with photos
and **prices**, build a cart, and send a structured order to the owner's **WhatsApp**. All
negotiation, billing, and payment continue on WhatsApp exactly as before. Max ~100 low-frequency
customers. Must run at **₹0/month**.

The old pain: the owner manually typed the same catalogue/stock to every buyer on WhatsApp all day,
and got flagged/blocked as a spammer. This app flips it to **inbound, customer-initiated** ordering,
which removes both the repetition and the spam-ban risk.

## Current status

- **Phase 0 (Scaffold) — COMPLETE.** The full v1 codebase in this repo. Syntax-checked; schema
  validated in SQLite. **Not yet deployed** to Cloudflare, and **not yet loaded with real data.**
- Next up is **Phase 1 (Setup & deploy)** — see "Immediate next steps".

## Locked decisions (do not re-litigate without asking the user)

1. **Stack: Cloudflare-native, free tier.** Cloudflare Pages (site) + Pages Functions (API) + D1
   (SQLite DB) + R2 (photos) + Cloudflare Access (admin login). Chosen over Supabase because it has
   no 7-day inactivity pause and no surprise-bill mechanism.
2. **Show prices in the catalogue: YES.**
3. **No WhatsApp Business API.** Use free `wa.me` deep links for both directions (owner→customer link
   delivery, customer→owner order). The owner already sees incoming messages on his phone, so there is
   NO "auto-detect incoming message" subsystem — approval = the owner generating a link in the admin.
4. **Customers do not log in.** Access is a secret, expiring magic link: `/s/<token>` (token hashed in
   DB, server-enforced expiry, revocable).
5. **Single-tenant** (one shop). Keep the schema clean so it *could* go multi-tenant later, but do not
   build multi-tenant now.
6. **Payments & fulfilment stay on WhatsApp.** Do not build payments.
7. **Vanilla HTML/CSS/JS frontend, no build step.** Do not introduce React/Vite/bundlers — the whole
   point is low maintenance and zero-build deploys on Pages.

## Architecture / file map

```
schema.sql                 D1 tables + a little SAMPLE data (delete sample rows once real data is in)
wrangler.toml              Cloudflare bindings — fill in your real D1 database_id
README.md                  full human setup guide (deploy steps, what-owner-provides)

public/                    static site (served by Pages)
  index.html               landing (points to /admin.html)
  s.html + assets/catalog.js   CUSTOMER catalogue: reads ?t=<token>, filters, cart, wa.me handoff
  admin.html + assets/admin.js OWNER panel: Stock / Articles / Customer Links / Orders / Settings
  assets/styles.css        shared styling (teal #0E6B57 / amber #E0A03C / ink #12332B)
  assets/common.js         fetch helper, toast, browser-side image compression before upload

functions/                 the API (Cloudflare Pages Functions, file-based routing)
  api/_util.js             shared helpers: json(), sha256hex(), token gen, isAdmin(), validToken()
  api/catalog.js           GET /api/catalog?token=…   (public, token-gated) → shop + filtered articles
  api/order.js             POST /api/order            (public, token-gated) → logs order, returns wa.me link
  api/img/[[path]].js      GET /api/img/<key>         → streams a photo from R2
  api/admin/articles.js    GET/POST/PATCH/DELETE articles (+ variants on create)
  api/admin/variants.js    POST add; PATCH bulk stock/price save (daily hot path); DELETE
  api/admin/photos.js      POST multipart upload → R2 + row; DELETE
  api/admin/tokens.js      GET list; POST create link (returns raw link once); PATCH revoke
  api/admin/orders.js      GET order log
  api/admin/settings.js    GET/POST shop_name, owner_phone, currency, show_prices, default_link_hours
  s/[token].js             pretty link /s/<token> → 302 redirect to /s.html?t=<token>
```

### Data model (D1 / SQLite)
`settings(key,value)` · `articles(id, article_code, name, category, description, base_price, is_active, created_at)`
· `variants(id, article_id, color, size, price, available_qty, is_active, updated_at)` (stock folded in here)
· `photos(id, article_id, color, url, sort_order)` · `access_tokens(id, token_hash, customer_label,
customer_phone, created_at, expires_at, is_revoked)` · `orders(id, token_id, customer_label, items_json,
est_total, created_at, status)`.

### The 3 core flows
- **Owner updates shop:** Admin → Stock → edit qty/price → Save (bulk PATCH /api/admin/variants).
- **Approve a customer:** Admin → Customer Links → create (label, phone, hours) → "Send on WhatsApp".
- **Customer orders:** open link → filter/cart → "Send Order on WhatsApp" → POST /api/order logs it and
  returns a `wa.me/<owner>?text=…` link → opens WhatsApp with the itemised order.

## Immediate next steps (Phase 1 — deploy). Help the user do these:

1. `npm install -g wrangler` then `wrangler login`.
2. `wrangler d1 create bagshop` → paste the printed `database_id` into `wrangler.toml`.
3. `wrangler r2 bucket create bagshop-photos`.
4. `wrangler d1 execute bagshop --file=./schema.sql --remote`.
5. Local test: `DEV=1 wrangler pages dev public --d1 DB=bagshop --r2 BUCKET=bagshop-photos` → open /admin.html.
6. Deploy: `wrangler pages deploy public --project-name bagshop`.
7. In the CF dashboard, add bindings `DB`→bagshop, `BUCKET`→bagshop-photos, env `DEV=0`,
   `ALLOWED_EMAILS=<owner email>`.
8. **Cloudflare Access (Zero Trust)** over paths `admin.html` and `api/admin/*`, allow owner's email.
9. Custom domain → the owner's domain. Then Settings: shop name, **owner WhatsApp number** (country
   code, no `+`), currency, show_prices = Yes.

Full detail is in `README.md`.

## What the owner still needs to provide
Cloudflare account + DNS access; the WhatsApp number orders go to; shop name/logo; and the catalogue
content: categories (bag types), colours & sizes, articles (code/name, price/pc, qty), and photos.

## Conventions & guardrails for you (the AI)
- Stay **free-tier only**. No paid add-ons, no heavy dependencies, no build step.
- **Security:** admin API depends on Cloudflare Access + the `isAdmin()` check. Keep `DEV=0` in
  production. Never commit secrets; the D1 `database_id` is fine to commit, access tokens are not.
- Tokens are stored **hashed** — never store or log raw tokens.
- This is a **v1 scaffold**: expect small fixes as it meets real Cloudflare + real data. That's normal.
- Remember to **delete the sample rows** in `schema.sql`/DB once the owner's real data is loaded.
- When unsure about a product/deploy detail, check the official Cloudflare and Claude Code docs rather
  than guessing.

## Roadmap
Phase 0 Scaffold ✅ · Phase 1 Setup & deploy (next) · Phase 2 Load real data · Phase 3 Pilot with 3–5
customers · Phase 4 Go live on the domain · Phase 5 Enhancements (low-stock badges, hide out-of-stock,
reorder-last-order, duplicate-article, price tiers, analytics; WhatsApp Cloud API only if volume grows).
