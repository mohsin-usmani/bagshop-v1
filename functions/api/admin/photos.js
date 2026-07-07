import { json, isAdmin, newId } from "../_util.js";

// POST multipart: file, article_id, (optional) color
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);

  const form = await request.formData();
  const file = form.get("file");
  const article_id = form.get("article_id");
  const color = form.get("color") || null;
  if (!file || !article_id) return json({ error: "bad_request" }, 400);

  const ext = ((file.name || "photo.jpg").split(".").pop() || "jpg").toLowerCase();
  const key = `articles/${article_id}/${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type || "image/jpeg" } });

  const id = newId();
  const url = `/api/img/${key}`;
  await env.DB.prepare(
    "INSERT INTO photos (id, article_id, color, url, sort_order) VALUES (?,?,?,?,?)"
  ).bind(id, article_id, color, url, Date.now()).run();

  return json({ ok: true, id, url });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  const row = await env.DB.prepare("SELECT url FROM photos WHERE id=?").bind(id).first();
  if (row && row.url && row.url.startsWith("/api/img/")) {
    const key = row.url.replace("/api/img/", "");
    try { await env.BUCKET.delete(key); } catch (e) {}
  }
  await env.DB.prepare("DELETE FROM photos WHERE id=?").bind(id).run();
  return json({ ok: true });
}
