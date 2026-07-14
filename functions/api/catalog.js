import { json, validToken, getSettings } from "./_util.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const tok = await validToken(env, url.searchParams.get("token"));
  if (!tok) return json({ error: "expired" }, 403);

  const settings = await getSettings(env);

  // A product is live purely on stock: it shows when it has at least one active
  // variant with qty > 0 (enforced by the variants query + the list filter below).
  // There is no separate article-level on/off switch.
  const articles = (await env.DB.prepare(
    "SELECT * FROM articles ORDER BY category, article_code"
  ).all()).results || [];
  const variants = (await env.DB.prepare(
    "SELECT * FROM variants WHERE is_active = 1 AND available_qty > 0"
  ).all()).results || [];
  const photos = (await env.DB.prepare(
    "SELECT * FROM photos ORDER BY sort_order"
  ).all()).results || [];
  const banners = (await env.DB.prepare(
    "SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order, id"
  ).all()).results || [];
  const catImgRows = (await env.DB.prepare(
    "SELECT * FROM category_images"
  ).all()).results || [];

  const byA = {};
  for (const a of articles) byA[a.id] = { ...a, variants: [], photos: [] };
  for (const v of variants) if (byA[v.article_id]) byA[v.article_id].variants.push(v);
  for (const p of photos) if (byA[p.article_id]) byA[p.article_id].photos.push(p);

  const list = Object.values(byA).filter((a) => a.variants.length > 0);

  // Only surface categories that actually have live products (derive from `list`,
  // not every article row) so empty categories don't appear in the filters/menu.
  const categories = [...new Set(list.map((a) => a.category).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];

  // Header menu: admin-picked, ordered categories (max 10). Only keep ones that
  // currently exist. Falls back to the first 10 categories if unconfigured.
  const navPicked = (settings.nav_categories || "").split(",").map((s) => s.trim()).filter(Boolean);
  let nav_categories = navPicked.filter((c) => categories.includes(c)).slice(0, 10);
  if (!nav_categories.length) nav_categories = categories.slice(0, 10);

  // Two photos per category (left/right) — the desktop header shows both side
  // by side; the admin's mobile_source/tile_source picks which single one
  // feeds the mobile header and the homepage tile respectively.
  const category_images = {};
  for (const r of catImgRows) {
    const left = r.left_image_url || r.image_url || "";
    const right = r.right_image_url || "";
    category_images[r.category] = {
      left_url: left,
      right_url: right,
      mobile_url: (r.mobile_source === "right" ? right : left) || right,
      tile_url: (r.tile_source === "right" ? right : left) || right,
    };
  }

  return json({
    shop: {
      name: settings.shop_name || "Shop",
      currency: settings.currency || "Rs.",
      show_prices: settings.show_prices === "1",
      about_us: settings.about_us || "",
      instagram_url: settings.instagram_url || "",
      facebook_url: settings.facebook_url || "",
      tagline: settings.tagline || "",
      logo_url: settings.logo_url || "",
      favicon_url: settings.favicon_url || "",
    },
    customer: tok.customer_label || "",
    filters: { categories, colors, sizes },
    nav_categories,
    articles: list,
    banners,
    category_images,
  });
}
