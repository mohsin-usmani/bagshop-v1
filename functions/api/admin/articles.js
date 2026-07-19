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
  // Products go live purely on stock (an active variant with qty > 0). There is no
  // separate article on/off switch, so new articles are created active by default.
  const isActive = b.is_active === 0 ? 0 : 1;
  await env.DB.prepare(
    "INSERT INTO articles (id, article_code, name, category, description, base_price, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_code || "", b.name || "", b.category || "", b.description || "", b.base_price ?? null, isActive, now).run();

  if (Array.isArray(b.variants)) {
    for (const v of b.variants) {
      // Default NOT live (see variants POST) — publish later via the Live toggle.
      await env.DB.prepare(
        "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(newId(), id, v.color || "", v.size || "", v.price ?? null, parseInt(v.qty) || 0, v.is_active ? 1 : 0, now).run();
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
  // "You may also like" picks — only touched when provided. Wrapped so a DB missing
  // the related_ids column (pre-migration) still saves the rest of the article.
  if (b.related_ids !== undefined) {
    const rel = JSON.stringify(Array.isArray(b.related_ids) ? b.related_ids : []);
    try { await env.DB.prepare("UPDATE articles SET related_ids=? WHERE id=?").bind(rel, b.id).run(); } catch (e) {}
  }
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  // remove children first (D1 does not cascade by default) — also clean up
  // the photo files themselves from R2, or deleting a product just orphans
  // its images in the bucket forever with no way to reclaim the storage.
  const photoRows = (await env.DB.prepare("SELECT url FROM photos WHERE article_id=?").bind(id).all()).results || [];
  for (const p of photoRows) {
    if (p.url && p.url.startsWith("/api/img/")) {
      try { await env.BUCKET.delete(p.url.replace("/api/img/", "")); } catch (e) {}
    }
  }
  await env.DB.prepare("DELETE FROM photos WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM variants WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
  return json({ ok: true });
}
