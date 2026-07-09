import { json, isAdmin } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare("SELECT * FROM category_images").all()).results || [];
  return json({ category_images: rows });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const category = fd.get("category");
  if (!file || !category) return json({ error: "missing file or category" }, 400);
  const old = await env.DB.prepare("SELECT image_key FROM category_images WHERE category=?").bind(category).first();
  if (old && old.image_key) { try { await env.BUCKET.delete(old.image_key); } catch (e) {} }
  const key = "catimg/" + category.replace(/[^a-zA-Z0-9-]/g, "_") + "-" + Date.now();
  const arr = await file.arrayBuffer();
  await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
  const image_url = "/api/img/" + key;
  await env.DB.prepare(
    "INSERT INTO category_images (category, image_key, image_url) VALUES (?,?,?) ON CONFLICT(category) DO UPDATE SET image_key=excluded.image_key, image_url=excluded.image_url"
  ).bind(category, key, image_url).run();
  return json({ ok: true, image_url });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  if (!category) return json({ error: "missing category" }, 400);
  const old = await env.DB.prepare("SELECT image_key FROM category_images WHERE category=?").bind(category).first();
  if (old && old.image_key) { try { await env.BUCKET.delete(old.image_key); } catch (e) {} }
  await env.DB.prepare("DELETE FROM category_images WHERE category=?").bind(category).run();
  return json({ ok: true });
}
