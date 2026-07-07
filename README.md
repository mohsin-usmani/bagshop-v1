# Wholesale Bag Shop — v1

A private, time-limited catalogue for a wholesale bag seller. Customers open a personal link,
browse live stock with photos and prices, build a cart, and send a structured order to the
owner's WhatsApp. All quoting, billing and payment continue on WhatsApp as before.

Runs entirely on Cloudflare's free tier: **Pages** (site) + **Functions** (API) + **D1** (database) +
**R2** (photos) + **Access** (admin login). Running cost at this scale: **₹0 / month.**

---

## What's in here

```
bagshop/
  schema.sql                 database tables + a little sample data
  wrangler.toml              Cloudflare bindings (fill in 1 id)
  public/                    the website (static)
    index.html               landing
    s.html + catalog.js      customer catalogue (reads the private link)
    admin.html + admin.js    owner panel: stock, articles, links, orders, settings
    assets/styles.css, common.js
  functions/                 the API (Cloudflare Pages Functions)
    api/catalog.js           GET catalogue (needs a valid token)
    api/order.js             POST order -> logs it, returns a wa.me link
    api/img/[[path]].js      serves photos from R2
    api/admin/*.js           articles, variants (stock), photos, tokens, orders, settings
    s/[token].js             pretty link  /s/<token>  ->  catalogue
```

---

## One-time setup (≈ 30–45 min, done once)

You need Node.js installed, then the Cloudflare CLI:

```bash
npm install -g wrangler
wrangler login                       # opens the browser to sign in to your Cloudflare account
```

**1. Create the database and storage**

```bash
wrangler d1 create bagshop           # copy the "database_id" it prints
wrangler r2 bucket create bagshop-photos
```

Paste the `database_id` into `wrangler.toml` (replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

**2. Load the tables**

```bash
wrangler d1 execute bagshop --file=./schema.sql --remote
```

**3. Try it locally first (optional but recommended)**

```bash
# DEV=1 lets you into the admin without login, for local testing only
DEV=1 wrangler pages dev public --d1 DB=bagshop --r2 BUCKET=bagshop-photos
# open the printed localhost URL -> /admin.html
```

**4. Deploy to Cloudflare**

```bash
wrangler pages deploy public --project-name bagshop
```

In the Cloudflare dashboard → **Workers & Pages → bagshop → Settings → Functions**, add the bindings:
- D1 database: variable name `DB` → `bagshop`
- R2 bucket: variable name `BUCKET` → `bagshop-photos`
- Environment variable: `DEV` = `0`
- Environment variable: `ALLOWED_EMAILS` = your admin email(s), comma-separated

**5. Protect the admin (important)**

Cloudflare dashboard → **Zero Trust → Access → Applications → Add a self-hosted application**:
- Path 1: `admin.html`   Path 2: `api/admin/*`
- Policy: allow only your email(s).

Now only you can open the admin; everyone else only sees catalogue links you hand out.

**6. Connect your domain**

bagshop project → **Custom domains** → add `shop.yourdomain.com` (or your root). Cloudflare guides the DNS.
Your customer links will then look like `https://shop.yourdomain.com/s/<token>`.

**7. Set your details**

Open `/admin.html` → **Settings**: shop name, **your WhatsApp number** (country code, no `+`),
currency, and confirm "Show prices = Yes".

You're live. Add your articles in **Articles**, update numbers in **Stock**, and hand out links from **Customer Links**.

---

## Daily use (for the owner)

- **A customer wants to order** → Admin → *Customer Links* → enter their name + number → *Create link* → *Send on WhatsApp*.
- **Update stock** → Admin → *Stock* → change quantities → *Save changes*.
- **Add a new bag** → Admin → *Articles* → *Add new bag* → add colours/sizes and photos.
- **Orders** arrive in your normal WhatsApp; a copy is also listed under *Orders*.

---

## Things I need from you (to finish the build & go live)

**Accounts & access (you do these — I can't create accounts or touch DNS/passwords for you):**
1. A **Cloudflare account** (free) and the domain you already own.
2. **DNS access** for that domain (to connect it to the site).
3. The **email** you'll use to log into the admin (for the Access allow-list).

**Details:**
4. **Owner WhatsApp number** that orders should land on — country code + number, e.g. `9198XXXXXX12`.
5. **Shop display name** (and a logo if you have one).

**Catalogue content (this is the real work — I can help you bulk-load it):**
6. **Category list** — your bag types (Handbag, Backpack, Jute, Duffel, …).
7. **Colours & sizes** you commonly stock.
8. **Articles**: code/name, **price per piece**, and starting quantities.
9. **Photos** per article (phone photos are fine — they're auto-shrunk on upload).

**Decisions:**
10. Show prices in catalogue — **YES** (locked in). ✔
11. Default link validity — suggest **4 hours** (change anytime in Settings).

Give me 6–9 and I can prepare a ready-to-import list so setup is fast.

---

## Roadmap

**Phase 0 — Scaffold** ✅ (this)
The full working v1 codebase.

**Phase 1 — Setup & deploy**
Create Cloudflare account, D1 + R2, deploy, connect domain, turn on Access, set shop name + number.

**Phase 2 — Load real data**
Categories, articles, colours/sizes, prices, photos. Delete the sample rows.

**Phase 3 — Pilot**
Generate links for 3–5 trusted customers, run real orders end-to-end, fix any rough edges.

**Phase 4 — Go live**
Roll out to all customers on your domain.

**Phase 5 — Enhancements (as needed)**
Low-stock badges & hide-out-of-stock, "reorder last order", duplicate-article to speed entry,
per-customer price tiers, simple sales analytics, and (only if volume grows) WhatsApp Cloud API
to auto-send links.

---

## Notes & limits (honest)

- This is a **v1 scaffold**, structured and syntax-checked, ready to deploy — expect a few small
  fixes during Phase 1/3 as it meets real Cloudflare + real data. That's normal; we iterate.
- Admin security depends on **Cloudflare Access** being configured (step 5). Until then, keep `DEV=0`
  in production so the admin API rejects unauthenticated calls.
- Free-tier headroom is large for ~100 low-frequency customers. If you ever outgrow it, Cloudflare's
  paid Workers plan is about $5/mo — not needed now.
- Payments and negotiation stay on WhatsApp by design.
