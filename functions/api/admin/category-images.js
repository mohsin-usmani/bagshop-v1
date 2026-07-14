import { json, isAdmin } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare("SELECT * FROM category_images").all()).results || [];
  return json({ category_images: rows });
}

// side: "left" | "right" — which of the two category photos this upload fills.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const category = fd.get("category");
  const side = fd.get("side") === "right" ? "right" : "left";
  if (!file || !category) return json({ error: "missing file or category" }, 400);
  const keyCol = side + "_image_key", urlCol = side + "_image_url";
  const old = await env.DB.prepare("SELECT " + keyCol + " AS k FROM category_images WHERE category=?").bind(category).first();
  if (old && old.k) { try { await env.BUCKET.delete(old.k); } catch (e) {} }
  const key = "catimg/" + category.replace(/[^a-zA-Z0-9-]/g, "_") + "-" + side + "-" + Date.now();
  const arr = await file.arrayBuffer();
  await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
  const image_url = "/api/img/" + key;
  await env.DB.prepare(
    "INSERT INTO category_images (category, " + keyCol + ", " + urlCol + ") VALUES (?,?,?) " +
    "ON CONFLICT(category) DO UPDATE SET " + keyCol + "=excluded." + keyCol + ", " + urlCol + "=excluded." + urlCol
  ).bind(category, key, image_url).run();
  return json({ ok: true, image_url, side });
}

// Sets which side ("left"/"right") feeds the mobile header and/or the homepage tile.
export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.category) return json({ error: "missing category" }, 400);
  if (b.mobile_source !== undefined) {
    const v = b.mobile_source === "right" ? "right" : "left";
    await env.DB.prepare("UPDATE category_images SET mobile_source=? WHERE category=?").bind(v, b.category).run();
  }
  if (b.tile_source !== undefined) {
    const v = b.tile_source === "right" ? "right" : "left";
    await env.DB.prepare("UPDATE category_images SET tile_source=? WHERE category=?").bind(v, b.category).run();
  }
  return json({ ok: true });
}

// side: "left" | "right" — omit to remove the whole row (both photos).
export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const side = url.searchParams.get("side");
  if (!category) return json({ error: "missing category" }, 400);
  if (side === "left" || side === "right") {
    const keyCol = side + "_image_key", urlCol = side + "_image_url";
    const old = await env.DB.prepare("SELECT " + keyCol + " AS k FROM category_images WHERE category=?").bind(category).first();
    if (old && old.k) { try { await env.BUCKET.delete(old.k); } catch (e) {} }
    await env.DB.prepare("UPDATE category_images SET " + keyCol + "=NULL, " + urlCol + "=NULL WHERE category=?").bind(category).run();
  } else {
    const old = await env.DB.prepare("SELECT left_image_key, right_image_key FROM category_images WHERE category=?").bind(category).first();
    if (old) {
      if (old.left_image_key) { try { await env.BUCKET.delete(old.left_image_key); } catch (e) {} }
      if (old.right_image_key) { try { await env.BUCKET.delete(old.right_image_key); } catch (e) {} }
    }
    await env.DB.prepare("DELETE FROM category_images WHERE category=?").bind(category).run();
  }
  return json({ ok: true });
}
