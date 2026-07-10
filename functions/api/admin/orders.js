import { json, isAdmin } from "../_util.js";

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const rows = (await env.DB.prepare(
    "SELECT id, customer_label, items_json, est_total, created_at, status FROM orders ORDER BY created_at DESC LIMIT 200"
  ).all()).results || [];
  const orders = rows.map((r) => {
    let count = 0;
    try { count = (JSON.parse(r.items_json) || []).length; } catch (e) {}
    return { id: r.id, customer_label: r.customer_label, item_count: count, est_total: r.est_total, created_at: r.created_at, status: r.status };
  });
  return json({ orders });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);
  await env.DB.prepare("DELETE FROM orders WHERE id=?").bind(id).run();
  return json({ ok: true });
}
