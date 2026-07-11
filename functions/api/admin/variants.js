import { json, isAdmin, newId } from "../_util.js";

// Add a variant to an existing article
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.article_id) return json({ error: "no_article" }, 400);
  const id = newId();
  // New colours default to NOT live so a product isn't published until the admin
  // ticks Live (in the wizard or the Stock tab). Pass is_active:1 to add it live.
  const active = b.is_active ? 1 : 0;
  await env.DB.prepare(
    "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_id, b.color || "", b.size || "", b.price ?? null, parseInt(b.qty) || 0, active, Date.now()).run();
  return json({ ok: true, id });
}

// Bulk update — the daily "update stock" save. Body: { updates: [{id, available_qty, price?, is_active?}] }
export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const ups = Array.isArray(b.updates) ? b.updates : [];
  const now = Date.now();
  for (const u of ups) {
    const price = u.price === "" || u.price == null ? null : Number(u.price);
    const active = u.is_active === undefined ? 1 : (u.is_active ? 1 : 0);
    await env.DB.prepare(
      "UPDATE variants SET available_qty=?, price=?, is_active=?, updated_at=? WHERE id=?"
    ).bind(parseInt(u.available_qty) || 0, price, active, now, u.id).run();
  }
  return json({ ok: true, updated: ups.length });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM variants WHERE id=?").bind(id).run();
  return json({ ok: true });
}
