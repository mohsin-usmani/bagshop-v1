import { json, isAdmin, newId } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const banners = (await env.DB.prepare("SELECT * FROM banners ORDER BY sort_order, id").all()).results || [];
  return json({ banners });
}

function parseVariants(json_str) {
  if (!json_str) return {};
  try { return JSON.parse(json_str) || {}; } catch (e) { return {}; }
}

// One photo, independently framed per placement (desktop/mobile), same
// pattern as category images. target: "desktop" | "mobile" | "original".
// id: omit to create a new banner; pass an existing banner's id to update
// just its images (used by "Adjust" and by the later targets in the same
// upload, since the first POST creates the row and returns its id).
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const target = ["desktop", "mobile", "original"].includes(fd.get("target")) ? fd.get("target") : null;
  const existingId = fd.get("id") || "";
  if (!file || !target) return json({ error: "missing file or target" }, 400);
  let rect = null;
  try { rect = JSON.parse(fd.get("rect") || "null"); } catch (e) {}

  const id = existingId || newId();
  let variants = {};
  if (existingId) {
    const old = await env.DB.prepare("SELECT variants_json FROM banners WHERE id=?").bind(existingId).first();
    if (old) variants = parseVariants(old.variants_json);
  }
  if (variants[target] && variants[target].key) { try { await env.BUCKET.delete(variants[target].key); } catch (e) {} }
  const key = "banners/" + id + "-" + target + "-" + Date.now();
  const arr = await file.arrayBuffer();
  await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
  const url = "/api/img/" + key;
  variants[target] = rect ? { key, url, rect } : { key, url };

  const rep = variants.desktop || variants.mobile;
  if (existingId) {
    await env.DB.prepare("UPDATE banners SET image_key=?, image_url=?, variants_json=? WHERE id=?")
      .bind(rep.key, rep.url, JSON.stringify(variants), existingId).run();
  } else {
    const link_url = fd.get("link_url") || "";
    const sort_order = Number(fd.get("sort_order") || 0);
    await env.DB.prepare(
      "INSERT INTO banners (id, image_key, image_url, link_url, sort_order, is_active, variants_json) VALUES (?,?,?,?,?,1,?)"
    ).bind(id, rep.key, rep.url, link_url, sort_order, JSON.stringify(variants)).run();
  }
  return json({ ok: true, id, image_url: url, target });
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
  const row = await env.DB.prepare("SELECT image_key, variants_json FROM banners WHERE id=?").bind(id).first();
  if (row) {
    if (row.image_key) { try { await env.BUCKET.delete(row.image_key); } catch (e) {} }
    for (const v of Object.values(parseVariants(row.variants_json))) {
      if (v && v.key && v.key !== row.image_key) { try { await env.BUCKET.delete(v.key); } catch (e) {} }
    }
  }
  await env.DB.prepare("DELETE FROM banners WHERE id=?").bind(id).run();
  return json({ ok: true });
}
