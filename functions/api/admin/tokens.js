import { json, isAdmin, newId, newToken, sha256hex, getSettings } from "../_util.js";

// List links (never returns the raw token or hash)
export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare(
    "SELECT id, customer_label, customer_phone, created_at, expires_at, is_revoked FROM access_tokens ORDER BY created_at DESC LIMIT 200"
  ).all()).results || [];
  return json({ tokens: rows, now: Date.now() });
}

// Create a link. Body: { label, phone, hours }. Returns the full shareable link (shown once).
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const settings = await getSettings(env);
  const hours = Math.max(1, parseInt(b.hours) || parseInt(settings.default_link_hours) || 4);

  const raw = newToken();
  const hash = await sha256hex(raw);
  const now = Date.now();
  const expires = now + hours * 3600 * 1000;
  await env.DB.prepare(
    "INSERT INTO access_tokens (id, token_hash, customer_label, customer_phone, created_at, expires_at, is_revoked) VALUES (?,?,?,?,?,?,0)"
  ).bind(newId(), hash, b.label || "", (b.phone || "").replace(/[^0-9]/g, ""), now, expires).run();

  const origin = new URL(request.url).origin;
  const link = `${origin}/s/${raw}`;
  return json({ ok: true, link, expires_at: expires });
}

// Revoke a link. Body: { id }
export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("UPDATE access_tokens SET is_revoked=1 WHERE id=?").bind(b.id).run();
  return json({ ok: true });
}
