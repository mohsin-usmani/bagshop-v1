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

// Admin gate. Returns {ok, reason, email} so callers can surface useful errors.
export function checkAdmin(context) {
  const { request, env } = context;
  if (env.DEV === "1") return { ok: true };

  const allow = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Prefer the header injected by CF Access when it protects the API path
  const headerEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (headerEmail) {
    if (allow.length && !allow.includes(headerEmail))
      return { ok: false, reason: "email_not_allowed", email: headerEmail };
    return { ok: true, email: headerEmail };
  }

  // Fall back to CF_Authorization JWT cookie set by Access at login
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

// Backwards-compat alias — returns boolean
export function isAdmin(context) {
  return checkAdmin(context).ok;
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
