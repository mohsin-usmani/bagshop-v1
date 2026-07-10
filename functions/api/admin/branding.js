import { json, isAdmin } from "../_util.js";

// Stores the header logo / favicon in R2 and saves its URL in settings.
// POST multipart: file, kind ("logo" | "favicon")
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const fd = await request.formData();
  const file = fd.get("file");
  const kind = (fd.get("kind") || "").toString();
  if (!file || (kind !== "logo" && kind !== "favicon")) return json({ error: "bad_request" }, 400);

  const settingKey = kind === "logo" ? "logo_url" : "favicon_url";
  // Remove the previous file from R2 if it was one of ours.
  const prev = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(settingKey).first();
  if (prev && prev.value && prev.value.startsWith("/api/img/")) {
    try { await env.BUCKET.delete(prev.value.replace("/api/img/", "")); } catch (e) {}
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

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "logo" && kind !== "favicon") return json({ error: "bad_request" }, 400);
  const settingKey = kind === "logo" ? "logo_url" : "favicon_url";
  const prev = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(settingKey).first();
  if (prev && prev.value && prev.value.startsWith("/api/img/")) {
    try { await env.BUCKET.delete(prev.value.replace("/api/img/", "")); } catch (e) {}
  }
  await env.DB.prepare("DELETE FROM settings WHERE key=?").bind(settingKey).run();
  return json({ ok: true });
}
