import { json, isAdmin, newId } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const banners = (await env.DB.prepare("SELECT * FROM banners ORDER BY sort_order, id").all()).results || [];
  return json({ banners });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const link_url = fd.get("link_url") || "";
  const sort_order = Number(fd.get("sort_order") || 0);
  if (!file || !file.name) return json({ error: "no file" }, 400);
  const id = newId();
  const key = "banners/" + id + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const arr = await file.arrayBuffer();
  await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
  const image_url = "/api/img/" + key;
  await env.DB.prepare(
    "INSERT INTO banners (id, image_key, image_url, link_url, sort_order, is_active) VALUES (?,?,?,?,?,1)"
  ).bind(id, key, image_url, link_url, sort_order).run();
  return json({ ok: true, id, image_url });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const { id, link_url, sort_order, is_active } = b;
  if (link_url !== undefined) await env.DB.prepare("UPDATE banners SET link_url=? WHERE id=?").bind(link_url, id).run();
  if (sort_order !== undefined) await env.DB.prepare("UPDATE banners SET sort_order=? WHERE id=?").bind(Number(sort_order), id).run();
  if (is_active !== undefined) await env.DB.prepare("UPDATE banners SET is_active=? WHERE id=?").bind(is_active ? 1 : 0, id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "missing id" }, 400);
  const row = await env.DB.prepare("SELECT image_key FROM banners WHERE id=?").bind(id).first();
  if (row && row.image_key) { try { await env.BUCKET.delete(row.image_key); } catch (e) {} }
  await env.DB.prepare("DELETE FROM banners WHERE id=?").bind(id).run();
  return json({ ok: true });
}
