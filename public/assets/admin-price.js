// Owner-only order pricing screen (see functions/api/admin/price-order.js).
// Reached via the link embedded in a customer's order WhatsApp message when catalogue
// prices are hidden. The page is behind CF Access (path starts with "admin"), so a valid
// admin session already exists by the time these API calls run.

var ORDER = null;
var ORDER_ID = qs("order");

// CF Access edge case: if an API call trips the auth guard, common.js fires this event.
window.addEventListener("apiauthfail", function () {
  var w = document.getElementById("apWrap");
  if (!w) return;
  w.innerHTML =
    '<div class="ap-msg">Please sign in to price this order.' +
    '<div style="margin-top:14px"><button class="btn" onclick="doSignIn()">Sign In</button></div></div>';
});
function doSignIn() { window.location.href = "/api/admin/login-bounce"; }

function money(cur, n) { return esc(cur) + n; }

async function load() {
  if (!ORDER_ID) { setStatus("No order specified."); return; }
  const { ok, status, data } = await api("/api/admin/price-order?id=" + encodeURIComponent(ORDER_ID));
  if (status === 404 || (data && data.error === "not_found")) { setStatus("That order could not be found."); return; }
  if (!ok || !data || !data.order) {
    if (data && data.error === "auth") return; // authFail already handled via event
    setStatus("Could not load the order. Please refresh.");
    return;
  }
  ORDER = data.order;
  render();
}

function setStatus(msg) {
  const w = document.getElementById("apWrap");
  w.innerHTML = '<div class="ap-msg">' + esc(msg) + "</div>";
}

function render() {
  const o = ORDER, cur = o.currency;
  const w = document.getElementById("apWrap");
  const priced = o.status === "priced";

  const cards = o.items.map((it, i) => {
    const nameBits = [esc(it.name || it.article_code || "Item")];
    const meta = [];
    if (it.article_code && it.name) meta.push(esc(it.article_code));
    if (it.color) meta.push(esc(it.color));
    if (it.size) meta.push(esc(it.size));
    const val = it.price != null ? it.price : "";
    return (
      '<div class="ap-card">' +
        '<div class="ap-item-top">' +
          '<div><div class="ap-item-name">' + nameBits.join(" ") + "</div>" +
          (meta.length ? '<div class="ap-item-meta">' + meta.join(" · ") + "</div>" : "") + "</div>" +
          '<div class="ap-item-qty">Qty ' + it.qty + "</div>" +
        "</div>" +
        '<div class="ap-price-row">' +
          "<label>Price / pc</label>" +
          '<div class="ap-price-in"><span>' + esc(cur) + '</span>' +
            '<input type="number" min="0" step="1" inputmode="numeric" id="p' + i + '" value="' + val + '" oninput="recalc()"></div>' +
          '<span class="ap-line-total" id="lt' + i + '"></span>' +
        "</div>" +
      "</div>"
    );
  }).join("");

  w.innerHTML =
    '<div class="ap-head">Set prices</div>' +
    '<p class="ap-sub">' + esc(o.shop_name) + (o.customer_label ? " · Customer: " + esc(o.customer_label) : "") +
      (priced ? " · already priced (editing)" : "") + "</p>" +
    cards +
    '<div class="ap-grand"><span>Total</span><span id="apGrand">' + money(cur, 0) + "</span></div>" +
    '<div class="ap-actions">' +
      '<button class="btn" id="apSend" onclick="save()">Save &amp; send summary on WhatsApp</button>' +
      (o.has_phone ? "" : '<p class="ap-note">No phone number is stored for this order — after saving you can copy the summary and paste it into WhatsApp yourself.</p>') +
    "</div>";

  recalc();
}

function recalc() {
  if (!ORDER) return;
  const cur = ORDER.currency;
  let total = 0, allFilled = true;
  ORDER.items.forEach((it, i) => {
    const el = document.getElementById("p" + i);
    const raw = el ? el.value.trim() : "";
    const p = Number(raw);
    const valid = raw !== "" && isFinite(p) && p >= 0;
    if (!valid) allFilled = false;
    const line = valid ? p * it.qty : 0;
    total += line;
    const lt = document.getElementById("lt" + i);
    if (lt) lt.textContent = valid ? money(cur, line) : "";
  });
  const g = document.getElementById("apGrand");
  if (g) g.textContent = money(cur, total);
  const btn = document.getElementById("apSend");
  if (btn) btn.disabled = !allFilled;
}

async function save() {
  if (!ORDER) return;
  const prices = ORDER.items.map((it, i) => {
    const el = document.getElementById("p" + i);
    return Number(el ? el.value.trim() : "");
  });
  if (prices.some((p) => !(isFinite(p) && p >= 0))) { toast("Enter a price for every item"); return; }

  const btn = document.getElementById("apSend");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  const { ok, data } = await api("/api/admin/price-order", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: ORDER.id, prices }),
  });

  if (!ok || !data || !data.ok) {
    toast("Could not save. Please try again.");
    if (btn) { btn.disabled = false; btn.textContent = "Save & send summary on WhatsApp"; }
    return;
  }

  showSaved(data);
}

function showSaved(data) {
  const w = document.getElementById("apWrap");
  const cur = ORDER.currency;
  w.innerHTML =
    '<div class="ap-head">Prices saved</div>' +
    '<p class="ap-sub">Total ' + money(cur, data.est_total) + ". This is now in the customer's order history.</p>" +
    (data.whatsapp
      ? '<div class="ap-actions"><button class="btn" onclick="window.location.href=' + JSON.stringify(data.whatsapp) + '">Send summary on WhatsApp</button></div>'
      : '<p class="ap-note">No phone number stored — copy the summary below and send it to the customer on WhatsApp.</p>') +
    '<div class="ap-summary" id="apSummary">' + esc(data.text || "") + "</div>" +
    '<div style="margin-top:10px"><button class="btn ghost" onclick="copySummary()">Copy summary</button></div>';

  // Open WhatsApp automatically when we have a number (the button stays as a fallback).
  if (data.whatsapp) { try { window.location.href = data.whatsapp; } catch (e) {} }
}

function copySummary() {
  const el = document.getElementById("apSummary");
  const txt = el ? el.textContent : "";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast("Summary copied")).catch(() => toast("Copy failed"));
  } else {
    const t = document.createElement("textarea"); t.value = txt; document.body.appendChild(t);
    t.select(); try { document.execCommand("copy"); toast("Summary copied"); } catch (e) { toast("Copy failed"); }
    document.body.removeChild(t);
  }
}

load();
