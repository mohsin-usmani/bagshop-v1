// Shared helpers for Pages Functions. Underscore prefix => not a route, importable.

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

export async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// URL-safe, ~144-bit random token
export function newToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Admin gate. In production Cloudflare Access sits in front of /admin + /api/admin
// and injects the Cf-Access-Authenticated-User-Email header. DEV=1 bypasses for local testing.
export function isAdmin(context) {
  const { request, env } = context;
  if (env.DEV === "1") return true;
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return false;
  const allow = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length && !allow.includes(email)) return false;
  return true;
}

export async function getSettings(env) {
  const res = await env.DB.prepare("SELECT key, value FROM settings").all();
  const o = {};
  (res.results || []).forEach((r) => (o[r.key] = r.value));
  return o;
}

// Returns the token row if valid (exists, not revoked, not expired), else null.
export async function validToken(env, raw) {
  if (!raw) return null;
  const h = await sha256hex(raw);
  const row = await env.DB.prepare("SELECT * FROM access_tokens WHERE token_hash = ?").bind(h).first();
  if (!row) return null;
  if (row.is_revoked) return null;
  if (Date.now() > Number(row.expires_at)) return null;
  return row;
}
