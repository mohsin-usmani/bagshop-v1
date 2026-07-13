var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-uepFq8/functionsWorker-0.6807813167555545.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}
__name(json, "json");
__name2(json, "json");
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256hex, "sha256hex");
__name2(sha256hex, "sha256hex");
function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}
__name(newId, "newId");
__name2(newId, "newId");
function newToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(newToken, "newToken");
__name2(newToken, "newToken");
function checkAdmin(context) {
  const { request, env } = context;
  if (env.DEV === "1") return { ok: true };
  const allow = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const headerEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (headerEmail) {
    if (allow.length && !allow.includes(headerEmail))
      return { ok: false, reason: "email_not_allowed", email: headerEmail };
    return { ok: true, email: headerEmail };
  }
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/CF_Authorization=([^;]+)/);
  if (!m) return { ok: false, reason: "no_session" };
  try {
    const parts = m[1].split(".");
    if (parts.length !== 3) return { ok: false, reason: "bad_token" };
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.email) return { ok: false, reason: "bad_token" };
    if (allow.length && !allow.includes(payload.email))
      return { ok: false, reason: "email_not_allowed", email: payload.email };
    return { ok: true, email: payload.email };
  } catch {
    return { ok: false, reason: "bad_token" };
  }
}
__name(checkAdmin, "checkAdmin");
__name2(checkAdmin, "checkAdmin");
function isAdmin(context) {
  return checkAdmin(context).ok;
}
__name(isAdmin, "isAdmin");
__name2(isAdmin, "isAdmin");
async function getSettings(env) {
  const res = await env.DB.prepare("SELECT key, value FROM settings").all();
  const o = {};
  (res.results || []).forEach((r) => o[r.key] = r.value);
  return o;
}
__name(getSettings, "getSettings");
__name2(getSettings, "getSettings");
async function validToken(env, raw) {
  if (!raw) return null;
  const h = await sha256hex(raw);
  const row = await env.DB.prepare("SELECT * FROM access_tokens WHERE token_hash = ?").bind(h).first();
  if (!row) return null;
  if (row.is_revoked) return null;
  if (Date.now() > Number(row.expires_at)) return null;
  return row;
}
__name(validToken, "validToken");
__name2(validToken, "validToken");
async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const [artRes, varRes, photoRes] = await Promise.all([
    env.DB.prepare("SELECT * FROM articles ORDER BY created_at DESC").all(),
    env.DB.prepare("SELECT * FROM variants").all(),
    env.DB.prepare("SELECT * FROM photos ORDER BY sort_order").all()
  ]);
  const articles = artRes.results || [];
  const variants = varRes.results || [];
  const photos = photoRes.results || [];
  const byA = {};
  articles.forEach((a) => byA[a.id] = { ...a, variants: [], photos: [] });
  variants.forEach((v) => byA[v.article_id] && byA[v.article_id].variants.push(v));
  photos.forEach((p) => byA[p.article_id] && byA[p.article_id].photos.push(p));
  return json({ articles: Object.values(byA) });
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const id = newId();
  const now = Date.now();
  const isActive = b.is_active === 0 ? 0 : 1;
  await env.DB.prepare(
    "INSERT INTO articles (id, article_code, name, category, description, base_price, is_active, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_code || "", b.name || "", b.category || "", b.description || "", b.base_price ?? null, isActive, now).run();
  if (Array.isArray(b.variants)) {
    for (const v of b.variants) {
      await env.DB.prepare(
        "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(newId(), id, v.color || "", v.size || "", v.price ?? null, parseInt(v.qty) || 0, v.is_active ? 1 : 0, now).run();
    }
  }
  return json({ ok: true, id });
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  await env.DB.prepare(
    "UPDATE articles SET article_code=?, name=?, category=?, description=?, base_price=?, is_active=?, is_new_arrival=? WHERE id=?"
  ).bind(b.article_code, b.name, b.category, b.description, b.base_price ?? null, b.is_active ? 1 : 0, b.is_new_arrival ? 1 : 0, b.id).run();
  if (b.related_ids !== void 0) {
    const rel = JSON.stringify(Array.isArray(b.related_ids) ? b.related_ids : []);
    try {
      await env.DB.prepare("UPDATE articles SET related_ids=? WHERE id=?").bind(rel, b.id).run();
    } catch (e) {
    }
  }
  return json({ ok: true });
}
__name(onRequestPatch, "onRequestPatch");
__name2(onRequestPatch, "onRequestPatch");
async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM photos WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM variants WHERE article_id=?").bind(id).run();
  await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(id).run();
  return json({ ok: true });
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
async function onRequestGet2(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const banners = (await env.DB.prepare("SELECT * FROM banners ORDER BY sort_order, id").all()).results || [];
  return json({ banners });
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestPost2(context) {
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
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
async function onRequestPatch2(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const { id, link_url, sort_order, is_active } = b;
  if (link_url !== void 0) await env.DB.prepare("UPDATE banners SET link_url=? WHERE id=?").bind(link_url, id).run();
  if (sort_order !== void 0) await env.DB.prepare("UPDATE banners SET sort_order=? WHERE id=?").bind(Number(sort_order), id).run();
  if (is_active !== void 0) await env.DB.prepare("UPDATE banners SET is_active=? WHERE id=?").bind(is_active ? 1 : 0, id).run();
  return json({ ok: true });
}
__name(onRequestPatch2, "onRequestPatch2");
__name2(onRequestPatch2, "onRequestPatch");
async function onRequestDelete2(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "missing id" }, 400);
  const row = await env.DB.prepare("SELECT image_key FROM banners WHERE id=?").bind(id).first();
  if (row && row.image_key) {
    try {
      await env.BUCKET.delete(row.image_key);
    } catch (e) {
    }
  }
  await env.DB.prepare("DELETE FROM banners WHERE id=?").bind(id).run();
  return json({ ok: true });
}
__name(onRequestDelete2, "onRequestDelete2");
__name2(onRequestDelete2, "onRequestDelete");
async function onRequestPost3(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const kind = (fd.get("kind") || "").toString();
  if (!file || kind !== "logo" && kind !== "favicon") return json({ error: "bad_request" }, 400);
  const settingKey = kind === "logo" ? "logo_url" : "favicon_url";
  const prev = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(settingKey).first();
  if (prev && prev.value && prev.value.startsWith("/api/img/")) {
    try {
      await env.BUCKET.delete(prev.value.replace("/api/img/", ""));
    } catch (e) {
    }
  }
  const ext = ((file.name || "img.png").split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const key = `branding/${kind}-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: file.type || "image/png" } });
  const url = "/api/img/" + key;
  await env.DB.prepare(
    "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(settingKey, url).run();
  return json({ ok: true, url, kind });
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
async function onRequestDelete3(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "logo" && kind !== "favicon") return json({ error: "bad_request" }, 400);
  const settingKey = kind === "logo" ? "logo_url" : "favicon_url";
  const prev = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(settingKey).first();
  if (prev && prev.value && prev.value.startsWith("/api/img/")) {
    try {
      await env.BUCKET.delete(prev.value.replace("/api/img/", ""));
    } catch (e) {
    }
  }
  await env.DB.prepare("DELETE FROM settings WHERE key=?").bind(settingKey).run();
  return json({ ok: true });
}
__name(onRequestDelete3, "onRequestDelete3");
__name2(onRequestDelete3, "onRequestDelete");
async function onRequestGet3(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 403);
  const { results } = await env.DB.prepare(
    "SELECT category as name, COUNT(*) as article_count FROM articles WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY category"
  ).all();
  const extra = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  const storedCats = extra && extra.value ? extra.value.split(",").filter(Boolean) : [];
  const map = {};
  results.forEach((r) => {
    map[r.name] = r.article_count;
  });
  storedCats.forEach((c) => {
    if (!(c in map)) map[c] = 0;
  });
  const categories = Object.entries(map).map(([name, article_count]) => ({ name, article_count })).sort((a, b) => a.name.localeCompare(b.name));
  return json({ categories });
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
async function onRequestPost4(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 403);
  const { name } = await request.json();
  if (!name || !name.trim()) return json({ error: "Name required" }, 400);
  const trimmed = name.trim();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  const cats = existing && existing.value ? existing.value.split(",").filter(Boolean) : [];
  if (!cats.includes(trimmed)) cats.push(trimmed);
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('category_list', ?)").bind(cats.join(",")).run();
  return json({ ok: true });
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
async function onRequestPatch3(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 403);
  const { old_name, new_name } = await request.json();
  if (!old_name || !new_name || !new_name.trim()) return json({ error: "old_name and new_name required" }, 400);
  const trimmed = new_name.trim();
  await env.DB.prepare("UPDATE articles SET category=? WHERE category=?").bind(trimmed, old_name).run();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  if (existing && existing.value) {
    const cats = existing.value.split(",").map((c) => c === old_name ? trimmed : c);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='category_list'").bind(cats.join(",")).run();
  }
  const nav = await env.DB.prepare("SELECT value FROM settings WHERE key='nav_categories'").first();
  if (nav && nav.value) {
    const navCats = nav.value.split(",").map((c) => c.trim() === old_name ? trimmed : c);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='nav_categories'").bind(navCats.join(",")).run();
  }
  return json({ ok: true });
}
__name(onRequestPatch3, "onRequestPatch3");
__name2(onRequestPatch3, "onRequestPatch");
async function onRequestDelete4(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 403);
  const { name } = await request.json();
  if (!name) return json({ error: "name required" }, 400);
  await env.DB.prepare("UPDATE articles SET category='Uncategorized' WHERE category=?").bind(name).run();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  if (existing && existing.value) {
    const cats = existing.value.split(",").filter((c) => c !== name);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='category_list'").bind(cats.join(",")).run();
  }
  const nav = await env.DB.prepare("SELECT value FROM settings WHERE key='nav_categories'").first();
  if (nav && nav.value) {
    const navCats = nav.value.split(",").filter((c) => c.trim() !== name);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='nav_categories'").bind(navCats.join(",")).run();
  }
  return json({ ok: true });
}
__name(onRequestDelete4, "onRequestDelete4");
__name2(onRequestDelete4, "onRequestDelete");
async function onRequestGet4(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare("SELECT * FROM category_images").all()).results || [];
  return json({ category_images: rows });
}
__name(onRequestGet4, "onRequestGet4");
__name2(onRequestGet4, "onRequestGet");
async function onRequestPost5(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const category = fd.get("category");
  if (!file || !category) return json({ error: "missing file or category" }, 400);
  const old = await env.DB.prepare("SELECT image_key FROM category_images WHERE category=?").bind(category).first();
  if (old && old.image_key) {
    try {
      await env.BUCKET.delete(old.image_key);
    } catch (e) {
    }
  }
  const key = "catimg/" + category.replace(/[^a-zA-Z0-9-]/g, "_") + "-" + Date.now();
  const arr = await file.arrayBuffer();
  await env.BUCKET.put(key, arr, { httpMetadata: { contentType: file.type || "image/jpeg" } });
  const image_url = "/api/img/" + key;
  await env.DB.prepare(
    "INSERT INTO category_images (category, image_key, image_url) VALUES (?,?,?) ON CONFLICT(category) DO UPDATE SET image_key=excluded.image_key, image_url=excluded.image_url"
  ).bind(category, key, image_url).run();
  return json({ ok: true, image_url });
}
__name(onRequestPost5, "onRequestPost5");
__name2(onRequestPost5, "onRequestPost");
async function onRequestDelete5(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  if (!category) return json({ error: "missing category" }, 400);
  const old = await env.DB.prepare("SELECT image_key FROM category_images WHERE category=?").bind(category).first();
  if (old && old.image_key) {
    try {
      await env.BUCKET.delete(old.image_key);
    } catch (e) {
    }
  }
  await env.DB.prepare("DELETE FROM category_images WHERE category=?").bind(category).run();
  return json({ ok: true });
}
__name(onRequestDelete5, "onRequestDelete5");
__name2(onRequestDelete5, "onRequestDelete");
async function onRequestGet5(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare(
    "SELECT id, customer_label, items_json, est_total, created_at, status FROM orders ORDER BY created_at DESC LIMIT 200"
  ).all()).results || [];
  const orders = rows.map((r) => {
    let count = 0;
    try {
      count = (JSON.parse(r.items_json) || []).length;
    } catch (e) {
    }
    return { id: r.id, customer_label: r.customer_label, item_count: count, est_total: r.est_total, created_at: r.created_at, status: r.status };
  });
  return json({ orders });
}
__name(onRequestGet5, "onRequestGet5");
__name2(onRequestGet5, "onRequestGet");
async function onRequestDelete6(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id).run();
  return json({ ok: true });
}
__name(onRequestDelete6, "onRequestDelete6");
__name2(onRequestDelete6, "onRequestDelete");
async function onRequestPost6(context) {
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
__name(onRequestPost6, "onRequestPost6");
__name2(onRequestPost6, "onRequestPost");
async function onRequestDelete7(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  const row = await env.DB.prepare("SELECT url FROM photos WHERE id=?").bind(id).first();
  if (row && row.url && row.url.startsWith("/api/img/")) {
    const key = row.url.replace("/api/img/", "");
    try {
      await env.BUCKET.delete(key);
    } catch (e) {
    }
  }
  await env.DB.prepare("DELETE FROM photos WHERE id=?").bind(id).run();
  return json({ ok: true });
}
__name(onRequestDelete7, "onRequestDelete7");
__name2(onRequestDelete7, "onRequestDelete");
var ALLOWED = ["shop_name", "owner_phone", "currency", "show_prices", "default_link_hours", "about_us", "instagram_url", "facebook_url", "nav_categories"];
async function onRequestGet6(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  return json({ settings: await getSettings(env) });
}
__name(onRequestGet6, "onRequestGet6");
__name2(onRequestGet6, "onRequestGet");
async function onRequestPost7(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  for (const k of ALLOWED) {
    if (b[k] === void 0) continue;
    let v = String(b[k]);
    if (k === "owner_phone") v = v.replace(/[^0-9]/g, "");
    await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run();
  }
  return json({ ok: true, settings: await getSettings(env) });
}
__name(onRequestPost7, "onRequestPost7");
__name2(onRequestPost7, "onRequestPost");
async function suggestCustomers(env) {
  let rows = [];
  try {
    const t = (await env.DB.prepare(
      "SELECT customer_label AS label, customer_phone AS phone, created_at FROM access_tokens WHERE customer_phone IS NOT NULL AND customer_phone!=''"
    ).all()).results || [];
    rows = rows.concat(t);
  } catch (e) {
  }
  try {
    const o = (await env.DB.prepare(
      "SELECT customer_label AS label, customer_phone AS phone, created_at FROM orders WHERE customer_phone IS NOT NULL AND customer_phone!=''"
    ).all()).results || [];
    rows = rows.concat(o);
  } catch (e) {
  }
  rows.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  const seen = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const phone = String(r.phone || "").replace(/[^0-9]/g, "");
    if (!phone) continue;
    if (!seen.has(phone)) seen.set(phone, { label: String(r.label || "").trim(), phone });
    else {
      const ex = seen.get(phone);
      if (!ex.label && r.label) ex.label = String(r.label).trim();
    }
  }
  return json({ customers: [...seen.values()].slice(0, 500) });
}
__name(suggestCustomers, "suggestCustomers");
__name2(suggestCustomers, "suggestCustomers");
async function onRequestGet7(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  if (url.searchParams.get("suggest")) return suggestCustomers(env);
  const rows = (await env.DB.prepare(
    "SELECT id, customer_label, customer_phone, created_at, expires_at, is_revoked FROM access_tokens ORDER BY created_at DESC LIMIT 500"
  ).all()).results || [];
  return json({ tokens: rows, now: Date.now() });
}
__name(onRequestGet7, "onRequestGet7");
__name2(onRequestGet7, "onRequestGet");
async function onRequestPost8(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const settings = await getSettings(env);
  const hours = Math.max(1, parseInt(b.hours) || parseInt(settings.default_link_hours) || 4);
  let phone = (b.phone || "").replace(/[^0-9]/g, "");
  if (phone.length === 11 && phone[0] === "0") phone = phone.slice(1);
  if (phone.length === 10) phone = "91" + phone;
  const raw = newToken();
  const hash = await sha256hex(raw);
  const now = Date.now();
  const expires = now + hours * 3600 * 1e3;
  await env.DB.prepare(
    "INSERT INTO access_tokens (id, token_hash, customer_label, customer_phone, created_at, expires_at, is_revoked) VALUES (?,?,?,?,?,?,0)"
  ).bind(newId(), hash, b.label || "", phone, now, expires).run();
  const origin = new URL(request.url).origin;
  const link = `${origin}/s/${raw}`;
  return json({ ok: true, link, expires_at: expires });
}
__name(onRequestPost8, "onRequestPost8");
__name2(onRequestPost8, "onRequestPost");
async function onRequestPatch4(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.id) return json({ error: "no_id" }, 400);
  if (b.delta_hours !== void 0 && b.delta_hours !== null) {
    const delta = parseInt(b.delta_hours);
    if (!Number.isFinite(delta) || delta === 0) return json({ error: "bad_delta" }, 400);
    const row = await env.DB.prepare("SELECT expires_at FROM access_tokens WHERE id=?").bind(b.id).first();
    if (!row) return json({ error: "not_found" }, 404);
    let newExp = Number(row.expires_at) + delta * 3600 * 1e3;
    if (newExp < Date.now()) newExp = Date.now();
    await env.DB.prepare("UPDATE access_tokens SET expires_at=? WHERE id=?").bind(newExp, b.id).run();
    return json({ ok: true, expires_at: newExp });
  }
  await env.DB.prepare("UPDATE access_tokens SET is_revoked=1 WHERE id=?").bind(b.id).run();
  return json({ ok: true });
}
__name(onRequestPatch4, "onRequestPatch4");
__name2(onRequestPatch4, "onRequestPatch");
async function onRequestPost9(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.article_id) return json({ error: "no_article" }, 400);
  const id = newId();
  const active = b.is_active ? 1 : 0;
  await env.DB.prepare(
    "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_id, b.color || "", b.size || "", b.price ?? null, parseInt(b.qty) || 0, active, Date.now()).run();
  return json({ ok: true, id });
}
__name(onRequestPost9, "onRequestPost9");
__name2(onRequestPost9, "onRequestPost");
async function onRequestPatch5(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const ups = Array.isArray(b.updates) ? b.updates : [];
  const now = Date.now();
  for (const u of ups) {
    const price = u.price === "" || u.price == null ? null : Number(u.price);
    const active = u.is_active === void 0 ? 1 : u.is_active ? 1 : 0;
    await env.DB.prepare(
      "UPDATE variants SET available_qty=?, price=?, is_active=?, updated_at=? WHERE id=?"
    ).bind(parseInt(u.available_qty) || 0, price, active, now, u.id).run();
  }
  return json({ ok: true, updated: ups.length });
}
__name(onRequestPatch5, "onRequestPatch5");
__name2(onRequestPatch5, "onRequestPatch");
async function onRequestDelete8(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM variants WHERE id=?").bind(id).run();
  return json({ ok: true });
}
__name(onRequestDelete8, "onRequestDelete8");
__name2(onRequestDelete8, "onRequestDelete");
async function onRequest() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin.html" }
  });
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
async function onRequest2(context) {
  const { env } = context;
  const [art, vari] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as n FROM articles").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM variants").first()
  ]);
  return json({
    auth: "ok",
    dev_mode: env.DEV === "1",
    articles_in_db: art ? art.n : "db-error",
    variants_in_db: vari ? vari.n : "db-error"
  });
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
async function onRequestGet8(context) {
  const { params, env } = context;
  const key = Array.isArray(params.path) ? params.path.join("/") : params.path;
  if (!key) return new Response("not found", { status: 404 });
  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response("not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
}
__name(onRequestGet8, "onRequestGet8");
__name2(onRequestGet8, "onRequestGet");
async function onRequestGet9(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = await validToken(env, url.searchParams.get("token"));
  if (!tok) return json({ error: "expired" }, 403);
  const settings = await getSettings(env);
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
  const categories = [...new Set(list.map((a) => a.category).filter(Boolean))];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  const navPicked = (settings.nav_categories || "").split(",").map((s) => s.trim()).filter(Boolean);
  let nav_categories = navPicked.filter((c) => categories.includes(c)).slice(0, 10);
  if (!nav_categories.length) nav_categories = categories.slice(0, 10);
  const category_images = {};
  for (const r of catImgRows) category_images[r.category] = r.image_url;
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
      favicon_url: settings.favicon_url || ""
    },
    customer: tok.customer_label || "",
    filters: { categories, colors, sizes },
    nav_categories,
    articles: list,
    banners,
    category_images
  });
}
__name(onRequestGet9, "onRequestGet9");
__name2(onRequestGet9, "onRequestGet");
async function onRequestGet10(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = await validToken(env, url.searchParams.get("token"));
  if (!tok) return json({ error: "expired" }, 403);
  const phone = (tok.customer_phone || "").replace(/[^0-9]/g, "");
  if (!phone) return json({ orders: [], customer: tok.customer_label || "" });
  const rows = (await env.DB.prepare(
    "SELECT id, items_json, est_total, created_at, status FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 100"
  ).bind(phone).all()).results || [];
  const orders = rows.map((r) => {
    let items = [];
    try {
      items = JSON.parse(r.items_json) || [];
    } catch (e) {
    }
    return { id: r.id, items, est_total: r.est_total, created_at: r.created_at, status: r.status };
  });
  return json({ orders, customer: tok.customer_label || "" });
}
__name(onRequestGet10, "onRequestGet10");
__name2(onRequestGet10, "onRequestGet");
async function onRequestPost10(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const tok = await validToken(env, body.token);
  if (!tok) return json({ error: "expired" }, 403);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: "empty_cart" }, 400);
  const settings = await getSettings(env);
  const showPrices = settings.show_prices === "1";
  const cur = settings.currency || "Rs.";
  const ids = items.map((i) => i.variant_id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await env.DB.prepare(
    `SELECT v.id, v.color, v.size, v.price, a.article_code, a.name, a.base_price
       FROM variants v JOIN articles a ON a.id = v.article_id
      WHERE v.id IN (${placeholders})`
  ).bind(...ids).all()).results || [];
  const map = {};
  rows.forEach((r) => map[r.id] = r);
  const lines = [];
  const snapshot = [];
  let total = 0;
  items.forEach((it, idx) => {
    const v = map[it.variant_id];
    if (!v) return;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    const price = (v.price != null ? v.price : v.base_price) || 0;
    total += price * qty;
    const parts = [`${idx + 1}) ${v.article_code}${v.name ? " " + v.name : ""}`];
    if (v.color) parts.push(v.color);
    if (v.size) parts.push(v.size);
    parts.push(`Qty ${qty}`);
    if (showPrices) parts.push(`${cur}${price}/pc`);
    lines.push(parts.join(" | "));
    snapshot.push({ variant_id: v.id, article_code: v.article_code, name: v.name, color: v.color, size: v.size, qty, price });
  });
  const text = [
    `New Order - ${settings.shop_name || "Shop"}`,
    tok.customer_label ? `Customer: ${tok.customer_label}` : null,
    "--------------------------------",
    ...lines,
    "--------------------------------",
    showPrices ? `Indicative total: ${cur}${total}` : "Prices to be confirmed",
    "Sent via catalogue"
  ].filter(Boolean).join("\n");
  await env.DB.prepare(
    "INSERT INTO orders (id, token_id, customer_label, customer_phone, items_json, est_total, created_at, status) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(newId(), tok.id, tok.customer_label || "", (tok.customer_phone || "").replace(/[^0-9]/g, ""), JSON.stringify(snapshot), total, Date.now(), "sent").run();
  const wa = `https://wa.me/${settings.owner_phone}?text=${encodeURIComponent(text)}`;
  return json({ ok: true, whatsapp: wa });
}
__name(onRequestPost10, "onRequestPost10");
__name2(onRequestPost10, "onRequestPost");
async function onRequest3(context) {
  const check = checkAdmin(context);
  if (!check.ok) {
    return json({ error: "auth", reason: check.reason, email: check.email || null }, 401);
  }
  return context.next();
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest");
async function onRequestGet11(context) {
  const { params, request } = context;
  const t = params.token;
  const dest = new URL(`/s.html?t=${encodeURIComponent(t)}`, request.url).toString();
  return Response.redirect(dest, 302);
}
__name(onRequestGet11, "onRequestGet11");
__name2(onRequestGet11, "onRequestGet");
var routes = [
  {
    routePath: "/api/admin/articles",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/admin/articles",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/articles",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch]
  },
  {
    routePath: "/api/admin/articles",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/banners",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/admin/banners",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/banners",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch2]
  },
  {
    routePath: "/api/admin/banners",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/branding",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/admin/branding",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/admin/categories",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete4]
  },
  {
    routePath: "/api/admin/categories",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/admin/categories",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch3]
  },
  {
    routePath: "/api/admin/categories",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/admin/category-images",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete5]
  },
  {
    routePath: "/api/admin/category-images",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/admin/category-images",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/admin/orders",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete6]
  },
  {
    routePath: "/api/admin/orders",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/admin/photos",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete7]
  },
  {
    routePath: "/api/admin/photos",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/admin/settings",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/admin/settings",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/admin/tokens",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/admin/tokens",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch4]
  },
  {
    routePath: "/api/admin/tokens",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/admin/variants",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete8]
  },
  {
    routePath: "/api/admin/variants",
    mountPath: "/api/admin",
    method: "PATCH",
    middlewares: [],
    modules: [onRequestPatch5]
  },
  {
    routePath: "/api/admin/variants",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/admin/login-bounce",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/admin/status",
    mountPath: "/api/admin",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/img/:path*",
    mountPath: "/api/img",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/catalog",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/history",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api/order",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/admin",
    mountPath: "/api/admin",
    method: "",
    middlewares: [onRequest3],
    modules: []
  },
  {
    routePath: "/s/:token",
    mountPath: "/s",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet11]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-S3mkcR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-S3mkcR/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.6807813167555545.js.map
