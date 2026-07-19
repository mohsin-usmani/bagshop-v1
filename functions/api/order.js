import { json, validToken, getSettings, newId } from "./_util.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }

  const tok = await validToken(env, body.token);
  if (!tok) return json({ error: "expired" }, 403);

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: "empty_cart" }, 400);

  const settings = await getSettings(env);
  const showPrices = settings.show_prices === "1";
  const cur = settings.currency || "Rs.";

  const ids = items.map((i) => i.variant_id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await env.DB.prepare(
    `SELECT v.id, v.color, v.size, v.price, a.article_code, a.name, a.base_price
       FROM variants v JOIN articles a ON a.id = v.article_id
      WHERE v.id IN (${placeholders})`
  ).bind(...ids).all()).results || [];
  const map = {};
  rows.forEach((r) => (map[r.id] = r));

  const orderId = newId();
  const lines = [];
  const snapshot = []; // stored on the order so history reads it without re-joining variants
  let total = 0;
  items.forEach((it, idx) => {
    const v = map[it.variant_id];
    if (!v) return;
    const qty = Math.max(1, parseInt(it.qty) || 1);
    const price = (v.price != null ? v.price : v.base_price) || 0;
    total += price * qty;
    const parts = [`${idx + 1}) ${v.article_code}${v.name ? " " + v.name : ""}`];
    if (v.color) parts.push(v.color);
    if (v.size) parts.push(v.size);
    parts.push(`Qty ${qty}`);
    if (showPrices) parts.push(`${cur}${price}/pc`);
    lines.push(parts.join(" | "));
    // When prices are hidden the catalogue price is meaningless to the customer — the owner
    // sets a per-customer price later via /admin-price, which overwrites this snapshot. Store
    // null so nothing stale can surface in history before that happens.
    snapshot.push({ variant_id: v.id, article_code: v.article_code, name: v.name, color: v.color, size: v.size, qty, price: showPrices ? price : null });
  });

  // Owner-only link to price this specific order when prices are hidden (see /admin-price).
  // Goes into the customer's outgoing message so the owner can open it straight from WhatsApp.
  const priceLink = `${new URL(request.url).origin}/admin-price?order=${orderId}`;

  const text = [
    `New Order - ${settings.shop_name || "Shop"}`,
    tok.customer_label ? `Customer: ${tok.customer_label}` : null,
    "--------------------------------",
    ...lines,
    "--------------------------------",
    showPrices ? `Indicative total: ${cur}${total}` : "Prices to be confirmed",
    showPrices ? null : `Owner: add prices -> ${priceLink}`,
    "Sent via catalogue",
  ].filter(Boolean).join("\n");

  await env.DB.prepare(
    "INSERT INTO orders (id, token_id, customer_label, customer_phone, items_json, est_total, created_at, status) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(orderId, tok.id, tok.customer_label || "", (tok.customer_phone || "").replace(/[^0-9]/g, ""), JSON.stringify(snapshot), showPrices ? total : 0, Date.now(), showPrices ? "sent" : "awaiting_price").run();

  const wa = `https://wa.me/${settings.owner_phone}?text=${encodeURIComponent(text)}`;
  return json({ ok: true, whatsapp: wa });
}
