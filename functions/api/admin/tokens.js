import { json, isAdmin, newId, newToken, sha256hex } from "../_util.js";

// Distinct past customers (name + phone) for the create-link autocomplete.
// Sourced from BOTH access_tokens and orders so repeat buyers keep autofilling
// even after their old links are gone. Deduped by phone, most recent first,
// preferring a non-empty label.
async function suggestCustomers(env) {
  let rows = [];
  try {
    const t = (await env.DB.prepare(
      "SELECT customer_label AS label, customer_phone AS phone, created_at FROM access_tokens WHERE customer_phone IS NOT NULL AND customer_phone!=''"
    ).all()).results || [];
    rows = rows.concat(t);
  } catch (e) {}
  try {
    const o = (await env.DB.prepare(
      "SELECT customer_label AS label, customer_phone AS phone, created_at FROM orders WHERE customer_phone IS NOT NULL AND customer_phone!=''"
    ).all()).results || [];
    rows = rows.concat(o);
  } catch (e) {}
  rows.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  const seen = new Map();
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

// List links (never returns the raw token or hash). ?suggest=1 → autocomplete list.
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  if (url.searchParams.get("suggest")) return suggestCustomers(env);
  const rows = (await env.DB.prepare(
    "SELECT id, customer_label, customer_phone, created_at, expires_at, is_revoked FROM access_tokens ORDER BY created_at DESC LIMIT 500"
  ).all()).results || [];
  return json({ tokens: rows, now: Date.now() });
}

// Create a link. Body: { label, phone, hours }. Returns the full shareable link (shown once).
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const hours = Math.max(1, parseInt(b.hours) || 24);

  // Admin enters a 10-digit mobile; add the 91 country code (needed for wa.me).
  let phone = (b.phone || "").replace(/[^0-9]/g, "");
  if (phone.length === 11 && phone[0] === "0") phone = phone.slice(1);
  if (phone.length === 10) phone = "91" + phone;

  const raw = newToken();
  const hash = await sha256hex(raw);
  const now = Date.now();
  const expires = now + hours * 3600 * 1000;
  await env.DB.prepare(
    "INSERT INTO access_tokens (id, token_hash, customer_label, customer_phone, created_at, expires_at, is_revoked) VALUES (?,?,?,?,?,?,0)"
  ).bind(newId(), hash, b.label || "", phone, now, expires).run();

  const origin = new URL(request.url).origin;
  const link = `${origin}/s/${raw}`;
  return json({ ok: true, link, expires_at: expires });
}

// Patch a link:
//   { id, delta_hours: N }  → shift expiry by N hours (add if +, subtract if −)
//   { id }                  → revoke
export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.id) return json({ error: "no_id" }, 400);

  if (b.delta_hours !== undefined && b.delta_hours !== null) {
    const delta = parseInt(b.delta_hours);
    if (!Number.isFinite(delta) || delta === 0) return json({ error: "bad_delta" }, 400);
    const row = await env.DB.prepare("SELECT expires_at FROM access_tokens WHERE id=?").bind(b.id).first();
    if (!row) return json({ error: "not_found" }, 404);
    let newExp = Number(row.expires_at) + delta * 3600 * 1000;
    if (newExp < Date.now()) newExp = Date.now(); // subtracting past 'now' just expires it
    await env.DB.prepare("UPDATE access_tokens SET expires_at=? WHERE id=?").bind(newExp, b.id).run();
    return json({ ok: true, expires_at: newExp });
  }

  await env.DB.prepare("UPDATE access_tokens SET is_revoked=1 WHERE id=?").bind(b.id).run();
  return json({ ok: true });
}
