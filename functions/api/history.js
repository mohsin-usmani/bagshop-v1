import { json, validToken } from "./_util.js";

// Customer-facing purchase history. Gated by the customer's own link token; returns
// every order ever placed under that link's phone number, so history persists across
// all the links sent to that number over time (orders keep customer_phone even after
// the short-lived tokens are purged).
export async function onRequestGet(context) {
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
    try { items = JSON.parse(r.items_json) || []; } catch (e) {}
    // priced === the owner set per-customer prices for this order via /admin-price, so its
    // prices should show in history even when the catalogue is otherwise price-hidden.
    return { id: r.id, items, est_total: r.est_total, created_at: r.created_at, status: r.status, priced: r.status === "priced" };
  });

  return json({ orders, customer: tok.customer_label || "" });
}
