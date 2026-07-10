import { json, isAdmin, newId } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const [artRes, varRes, photoRes] = await Promise.all([
    env.DB.prepare("SELECT * FROM articles ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM variants").all(),
    env.DB.prepare("SELECT * FROM photos ORDER BY sort_order").all(),
  ]);
  const articles = artRes.results || [];
  const variants = varRes.results || [];
  const photos = photoRes.results || [];
  const byA = {};
  articles.forEach((a) => (byA[a.id] = { ...a, variants: [], photos: [] }));
  variants.forEach((v) => byA[v.article_id] && byA[v.article_id].variants.push(v));
  photos.forEach((p) => byA[p.article_id] && byA[p.article_id].photos.push(p));
  return json({ articles: Object.values(byA) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const id = newId();
  const now = Date.now();
  // New products are created hidden by default. They only go live when the admin
  // turns on "Show to customers" (step 3 of the wizard). Pass is_active:1 to override.
  const isActive = b.is_active ? 1 : 0;
  await env.DB.prepare(
    "INSERT INTO articles (id, article_code, name, category, description, base_price, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_code || "", b.name || "", b.category || "", b.description || "", b.base_price ?? null, isActive, now).run();

  if (Array.isArray(b.variants)) {
    for (const v of b.variants) {
      await env.DB.prepare(
        "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,1,?)"
      ).bind(newId(), id, v.color || "", v.size || "", v.price ?? null, parseInt(v.qty) || 0, now).run();
    }
  }
  return json({ ok: true, id });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  await env.DB.prepare(
    "UPDATE articles SET article_code=?, name=?, category=?, description=?, base_price=?, is_active=?, is_new_arrival=? WHERE id=?"
  ).bind(b.article_code, b.name, b.category, b.description, b.base_price ?? null, b.is_active ? 1 : 0, b.is_new_arrival ? 1 : 0, b.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  // remove children first (D1 does not cascade by default)
  await env.DB.prepare("DELETE FROM photos WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM variants WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
  return json({ ok: true });
}
