import { json, isAdmin, newId } from "../_util.js";

async function hasPhotos(env, article_id) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM photos WHERE article_id=?").bind(article_id).first();
  return !!(row && row.c);
}

// Add a variant to an existing article
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  if (!b.article_id) return json({ error: "no_article" }, 400);
  const id = newId();
  // New colours default to NOT live so a product isn't published until the admin
  // ticks Live (in the wizard or the Stock tab). Pass is_active:1 to add it live —
  // but only honoured if the article actually has a photo (see PATCH below for why).
  let active = b.is_active ? 1 : 0;
  let blocked = false;
  if (active && !(await hasPhotos(env, b.article_id))) { active = 0; blocked = true; }
  await env.DB.prepare(
    "INSERT INTO variants (id, article_id, color, size, price, available_qty, is_active, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, b.article_id, b.color || "", b.size || "", b.price ?? null, parseInt(b.qty) || 0, active, Date.now()).run();
  return json({ ok: true, id, blocked });
}

// Bulk update — the daily "update stock" save. Body: { updates: [{id, available_qty, price?, is_active?}] }
// A variant can only be switched live if its article has at least one uploaded
// photo — without this, a product with no real photo would still go live and
// customers would see resolvePhotos()'s generic Unsplash stock-photo guess
// instead of the actual product. Silently forces is_active back to 0 (rather
// than rejecting the whole batch) and reports which ids got blocked so the
// client can toast about it and un-check the box.
export async function onRequestPatch(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const b = await request.json();
  const ups = Array.isArray(b.updates) ? b.updates : [];
  const now = Date.now();
  const blocked = [];
  for (const u of ups) {
    const price = u.price === "" || u.price == null ? null : Number(u.price);
    let active = u.is_active === undefined ? 1 : (u.is_active ? 1 : 0);
    if (active) {
      const variant = await env.DB.prepare("SELECT article_id FROM variants WHERE id=?").bind(u.id).first();
      if (variant && !(await hasPhotos(env, variant.article_id))) { active = 0; blocked.push(u.id); }
    }
    await env.DB.prepare(
      "UPDATE variants SET available_qty=?, price=?, is_active=?, updated_at=? WHERE id=?"
    ).bind(parseInt(u.available_qty) || 0, price, active, now, u.id).run();
  }
  return json({ ok: true, updated: ups.length, blocked });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM variants WHERE id=?").bind(id).run();
  return json({ ok: true });
}
