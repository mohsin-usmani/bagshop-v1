import { json, validToken, getSettings } from "./_util.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const tok = await validToken(env, url.searchParams.get("token"));
  if (!tok) return json({ error: "expired" }, 403);

  const category = url.searchParams.get("category");
  const color = url.searchParams.get("color");
  const size = url.searchParams.get("size");
  const q = (url.searchParams.get("q") || "").toLowerCase();

  const settings = await getSettings(env);

  const articles = (await env.DB.prepare(
    "SELECT * FROM articles WHERE is_active = 1 ORDER BY category, article_code"
  ).all()).results || [];
  const variants = (await env.DB.prepare(
    "SELECT * FROM variants WHERE is_active = 1 AND available_qty > 0"
  ).all()).results || [];
  const photos = (await env.DB.prepare(
    "SELECT * FROM photos ORDER BY sort_order"
  ).all()).results || [];

  const byA = {};
  for (const a of articles) byA[a.id] = { ...a, variants: [], photos: [] };
  for (const v of variants) if (byA[v.article_id]) byA[v.article_id].variants.push(v);
  for (const p of photos) if (byA[p.article_id]) byA[p.article_id].photos.push(p);

  let list = Object.values(byA).filter((a) => a.variants.length > 0);
  if (category) list = list.filter((a) => a.category === category);
  if (color) list = list.map((a) => ({ ...a, variants: a.variants.filter((v) => v.color === color) })).filter((a) => a.variants.length);
  if (size) list = list.map((a) => ({ ...a, variants: a.variants.filter((v) => v.size === size) })).filter((a) => a.variants.length);
  if (q) list = list.filter((a) => (a.article_code || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q));

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];

  return json({
    shop: {
      name: settings.shop_name || "Shop",
      currency: settings.currency || "Rs.",
      show_prices: settings.show_prices === "1",
    },
    customer: tok.customer_label || "",
    filters: { categories, colors, sizes },
    articles: list,
  });
}
