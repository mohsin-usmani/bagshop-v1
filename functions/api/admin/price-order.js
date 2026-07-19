import { json, isAdmin, getSettings } from "../_util.js";

// Per-customer, per-order pricing for orders placed while catalogue prices are hidden.
// Reached via the owner-only /admin-price page (link is embedded in the customer's order
// WhatsApp message by functions/api/order.js). Auth is enforced by api/admin/_middleware.js;
// the isAdmin() checks here mirror the other admin endpoints and are harmless if redundant.

// GET /api/admin/price-order?id=<orderId> → order + line items for the pricing screen.
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "no_id" }, 400);

  const row = await env.DB.prepare(
    "SELECT id, customer_label, customer_phone, items_json, est_total, status FROM orders WHERE id=?"
  ).bind(id).first();
  if (!row) return json({ error: "not_found" }, 404);

  const settings = await getSettings(env);
  let items = [];
  try { items = JSON.parse(row.items_json) || []; } catch (e) {}

  return json({
    order: {
      id: row.id,
      customer_label: row.customer_label || "",
      has_phone: !!(row.customer_phone || "").replace(/[^0-9]/g, ""),
      status: row.status,
      currency: settings.currency || "Rs.",
      shop_name: settings.shop_name || "Shop",
      items: items.map((it) => ({
        article_code: it.article_code || "",
        name: it.name || "",
        color: it.color || "",
        size: it.size || "",
        qty: Math.max(1, parseInt(it.qty) || 1),
        price: it.price != null ? it.price : null,
      })),
    },
  });
}

// POST /api/admin/price-order  { id, prices: [number per line, index-aligned] }
// Writes the prices into the order snapshot, recomputes the total, marks it "priced",
// and returns a wa.me link to the customer carrying the priced summary.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }

  const id = body.id;
  const prices = Array.isArray(body.prices) ? body.prices : null;
  if (!id || !prices) return json({ error: "bad_request" }, 400);

  const row = await env.DB.prepare(
    "SELECT id, customer_label, customer_phone, items_json FROM orders WHERE id=?"
  ).bind(id).first();
  if (!row) return json({ error: "not_found" }, 404);

  let items = [];
  try { items = JSON.parse(row.items_json) || []; } catch (e) {}
  if (!items.length) return json({ error: "empty" }, 400);
  if (prices.length !== items.length) return json({ error: "count_mismatch" }, 400);

  const settings = await getSettings(env);
  const cur = settings.currency || "Rs.";

  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const p = Number(prices[i]);
    if (!isFinite(p) || p < 0) return json({ error: "bad_price", index: i }, 400);
    items[i].price = p;
    total += p * Math.max(1, parseInt(items[i].qty) || 1);
  }

  await env.DB.prepare(
    "UPDATE orders SET items_json=?, est_total=?, status='priced' WHERE id=?"
  ).bind(JSON.stringify(items), total, id).run();

  const lines = items.map((it, idx) => {
    const qty = Math.max(1, parseInt(it.qty) || 1);
    const parts = [`${idx + 1}) ${it.article_code}${it.name ? " " + it.name : ""}`];
    if (it.color) parts.push(it.color);
    if (it.size) parts.push(it.size);
    parts.push(`Qty ${qty}`);
    parts.push(`${cur}${it.price}/pc`);
    parts.push(`${cur}${it.price * qty}`);
    return parts.join(" | ");
  });

  const text = [
    `Order summary - ${settings.shop_name || "Shop"}`,
    row.customer_label ? `Customer: ${row.customer_label}` : null,
    "--------------------------------",
    ...lines,
    "--------------------------------",
    `Total: ${cur}${total}`,
  ].filter(Boolean).join("\n");

  const phone = (row.customer_phone || "").replace(/[^0-9]/g, "");
  const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;

  return json({ ok: true, whatsapp, est_total: total, text });
}
