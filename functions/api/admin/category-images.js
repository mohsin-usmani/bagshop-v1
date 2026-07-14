import { json, isAdmin } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare("SELECT * FROM category_images").all()).results || [];
  return json({ category_images: rows });
}

function parseVariants(json_str) {
  if (!json_str) return {};
  try { return JSON.parse(json_str) || {}; } catch (e) { return {}; }
}

// side: "left" | "right" — which of the two category photos this upload fills.
// target: "tile" | "mobile" | "desktop" — which placement's independent crop
// this is (each placement can be framed differently from the same photo).
// Omitting target keeps the old single-shared-crop behaviour for compatibility.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const category = fd.get("category");
  const side = fd.get("side") === "right" ? "right" : "left";
  const target = ["tile", "mobile", "desktop"].includes(fd.get("target")) ? fd.get("target") : null;
  if (!file || !category) return json({ error: "missing file or category" }, 400);
  const safeCat = category.replace(/[^a-zA-Z0-9-]/g, "_");
  const arr = await file.arrayBuffer();

  if (target) {
    const varCol = side + "_variants_json";
    const old = await env.DB.prepare("SELECT " + varCol + " AS vj FROM category_images WHERE category=?").bind(category).first();
    const variants = parseVariants(old && old.vj);
    if (variants[target] && variants[target].key) { try { await env.BUCKET.delete(variants[target].key); } catch (e) {} }
    const key = "catimg/" + safeCat + "-" + side + "-" + target + "-" + Date.now();
    await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
    const image_url = "/api/img/" + key;
    variants[target] = { key, url: image_url };
    await env.DB.prepare(
      "INSERT INTO category_images (category, " + varCol + ") VALUES (?,?) " +
      "ON CONFLICT(category) DO UPDATE SET " + varCol + "=excluded." + varCol
    ).bind(category, JSON.stringify(variants)).run();
    return json({ ok: true, image_url, side, target });
  }

  const keyCol = side + "_image_key", urlCol = side + "_image_url";
  const old = await env.DB.prepare("SELECT " + keyCol + " AS k FROM category_images WHERE category=?").bind(category).first();
  if (old && old.k) { try { await env.BUCKET.delete(old.k); } catch (e) {} }
  const key = "catimg/" + safeCat + "-" + side + "-" + Date.now();
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

// side: "left" | "right" — omit to remove the whole row (both photos, all variants).
export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const side = url.searchParams.get("side");
  if (!category) return json({ error: "missing category" }, 400);
  if (side === "left" || side === "right") {
    const keyCol = side + "_image_key", urlCol = side + "_image_url", varCol = side + "_variants_json";
    const old = await env.DB.prepare("SELECT " + keyCol + " AS k, " + varCol + " AS vj FROM category_images WHERE category=?").bind(category).first();
    if (old) {
      if (old.k) { try { await env.BUCKET.delete(old.k); } catch (e) {} }
      const variants = parseVariants(old.vj);
      for (const v of Object.values(variants)) { if (v && v.key) { try { await env.BUCKET.delete(v.key); } catch (e) {} } }
    }
    await env.DB.prepare("UPDATE category_images SET " + keyCol + "=NULL, " + urlCol + "=NULL, " + varCol + "=NULL WHERE category=?").bind(category).run();
  } else {
    const old = await env.DB.prepare("SELECT left_image_key, right_image_key, left_variants_json, right_variants_json FROM category_images WHERE category=?").bind(category).first();
    if (old) {
      if (old.left_image_key) { try { await env.BUCKET.delete(old.left_image_key); } catch (e) {} }
      if (old.right_image_key) { try { await env.BUCKET.delete(old.right_image_key); } catch (e) {} }
      for (const v of Object.values(parseVariants(old.left_variants_json))) { if (v && v.key) { try { await env.BUCKET.delete(v.key); } catch (e) {} } }
      for (const v of Object.values(parseVariants(old.right_variants_json))) { if (v && v.key) { try { await env.BUCKET.delete(v.key); } catch (e) {} } }
    }
    await env.DB.prepare("DELETE FROM category_images WHERE category=?").bind(category).run();
  }
  return json({ ok: true });
}
