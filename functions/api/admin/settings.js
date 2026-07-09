import { json, isAdmin, getSettings } from "../_util.js";

const ALLOWED = ["shop_name", "owner_phone", "currency", "show_prices", "default_link_hours", "about_us", "instagram_url", "facebook_url"];

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  return json({ settings: await getSettings(env) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  for (const k of ALLOWED) {
    if (b[k] === undefined) continue;
    let v = String(b[k]);
    if (k === "owner_phone") v = v.replace(/[^0-9]/g, "");
    await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run();
  }
  return json({ ok: true, settings: await getSettings(env) });
}
