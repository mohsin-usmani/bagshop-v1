let ARTICLES = [];
let SETTINGS = {};

// ---- tabs ----
document.getElementById("tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "p-" + t.dataset.p));
});

async function loadAll() {
  await Promise.all([loadSettings(), loadArticles()]);
  loadLinks(); loadOrders();
}

// ---- settings ----
async function loadSettings() {
  const { data } = await api("/api/admin/settings");
  if (!data || data.error) return authFail(data);
  SETTINGS = data.settings || {};
  document.getElementById("hdrName").textContent = (SETTINGS.shop_name || "Shop") + " — Admin";
  st_name.value = SETTINGS.shop_name || "";
  st_phone.value = SETTINGS.owner_phone || "";
  st_cur.value = SETTINGS.currency || "Rs.";
  st_hours.value = SETTINGS.default_link_hours || "4";
  st_show.value = SETTINGS.show_prices || "1";
}
async function saveSettings() {
  const body = { shop_name: st_name.value, owner_phone: st_phone.value, currency: st_cur.value,
    default_link_hours: st_hours.value, show_prices: st_show.value };
  const { ok, data } = await api("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { SETTINGS = data.settings; toast("Settings saved"); document.getElementById("hdrName").textContent = (SETTINGS.shop_name || "Shop") + " — Admin"; }
  else toast("Save failed");
}

// ---- articles + stock ----
async function loadArticles() {
  const { data } = await api("/api/admin/articles");
  if (!data || data.error) return authFail(data);
  ARTICLES = data.articles || [];
  renderStock(); renderArticles(); renderCatList();
}

function allVariants() {
  const rows = [];
  ARTICLES.forEach((a) => a.variants.forEach((v) => rows.push({ a, v })));
  return rows;
}

function renderStock() {
  const rows = allVariants();
  const cur = SETTINGS.currency || "Rs.";
  if (!rows.length) { document.getElementById("stockTable").innerHTML = '<p class="muted">No articles yet. Add one in the Articles tab.</p>'; return; }
  document.getElementById("stockTable").innerHTML =
    '<table><thead><tr><th>Bag</th><th>Colour</th><th>Size</th><th>Price (' + esc(cur) + ')</th><th>Qty</th><th>Live</th></tr></thead><tbody>' +
    rows.map(({ a, v }) =>
      '<tr data-id="' + v.id + '">' +
      '<td><strong>' + esc(a.article_code) + '</strong><br><span class="muted" style="font-size:12px">' + esc(a.name || "") + '</span></td>' +
      '<td>' + esc(v.color || "") + '</td><td>' + esc(v.size || "") + '</td>' +
      '<td><input class="pricebox price-in" type="number" value="' + (v.price != null ? v.price : "") + '" placeholder="' + (a.base_price ?? "") + '"></td>' +
      '<td><input class="qtybox qty-in" type="number" value="' + v.available_qty + '"></td>' +
      '<td><input type="checkbox" class="act-in" ' + (v.is_active ? "checked" : "") + ' style="width:auto"></td>' +
      '</tr>').join("") + '</tbody></table>';
}

async function saveStock() {
  const updates = [...document.querySelectorAll("#stockTable tr[data-id]")].map((tr) => ({
    id: tr.dataset.id,
    available_qty: tr.querySelector(".qty-in").value,
    price: tr.querySelector(".price-in").value,
    is_active: tr.querySelector(".act-in").checked,
  }));
  const { ok } = await api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates }) });
  if (ok) { toast("Stock saved (" + updates.length + " rows)"); loadArticles(); } else toast("Save failed");
}

function renderCatList() {
  const cats = [...new Set(ARTICLES.map((a) => a.category).filter(Boolean))];
  document.getElementById("catList").innerHTML = cats.map((c) => '<option value="' + esc(c) + '">').join("");
}

function renderArticles() {
  const cur = SETTINGS.currency || "Rs.";
  const el = document.getElementById("artList");
  if (!ARTICLES.length) { el.innerHTML = '<p class="muted">No articles yet.</p>'; return; }
  el.innerHTML = ARTICLES.map((a) => {
    const vs = a.variants.map((v) =>
      '<div class="line"><div>' + esc(v.color || "") + ' · ' + esc(v.size || "") +
      ' <span class="muted">(' + v.available_qty + ' in stock' + (v.price != null ? ', ' + esc(cur) + v.price : '') + ')</span></div>' +
      '<span class="x" onclick="delVariant(' + jq(v.id) + ')">✕</span></div>').join("") || '<p class="muted" style="font-size:13px">No colours/sizes yet.</p>';
    const photos = (a.photos || []).map((p) =>
      '<div class="t"><img src="' + esc(p.url) + '"><span class="rm" onclick="delPhoto(' + jq(p.id) + ')">✕</span></div>').join("");
    return '<div class="card artcard">' +
      '<div class="hd"><div><strong>' + esc(a.article_code) + '</strong> — ' + esc(a.name || "") + ' <span class="tag">' + esc(a.category) + '</span></div>' +
      '<button class="btn danger sm" onclick="delArticle(' + jq(a.id) + ')">Delete</button></div>' +
      '<div class="grid2"><div>' +
        '<div style="margin-bottom:8px">' + vs + '</div>' +
        '<div class="row-actions" style="align-items:end">' +
          '<div style="width:100px"><label>Colour</label><input id="vc_' + a.id + '"></div>' +
          '<div style="width:90px"><label>Size</label><input id="vs_' + a.id + '"></div>' +
          '<div style="width:90px"><label>Price</label><input id="vp_' + a.id + '" type="number"></div>' +
          '<div style="width:80px"><label>Qty</label><input id="vq_' + a.id + '" type="number" value="0"></div>' +
          '<button class="btn sm" onclick="addVariant(' + jq(a.id) + ')">Add</button>' +
        '</div></div>' +
      '<div><label>Photos</label><div class="thumbs">' + photos + '</div>' +
        '<div style="margin-top:8px"><input type="file" accept="image/*" onchange="uploadPhoto(' + jq(a.id) + ',this)"></div>' +
        '<p class="muted" style="font-size:12px">Phone photos are fine. They are auto-shrunk before upload.</p></div>' +
      '</div></div>';
  }).join("");
}

function toggleAdd() { const f = document.getElementById("addForm"); f.style.display = f.style.display === "none" ? "block" : "none"; }

async function createArticle() {
  const body = { article_code: na_code.value.trim(), name: na_name.value.trim(), category: na_cat.value.trim(),
    base_price: na_price.value ? Number(na_price.value) : null, description: na_desc.value.trim() };
  if (!body.article_code || !body.category) return toast("Code and category are required");
  const { ok } = await api("/api/admin/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { toast("Article added"); na_code.value = na_name.value = na_cat.value = na_price.value = na_desc.value = ""; toggleAdd(); loadArticles(); }
  else toast("Failed");
}
async function delArticle(id) {
  if (!confirm("Delete this article and all its colours/photos?")) return;
  const { ok } = await api("/api/admin/articles?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Deleted"); loadArticles(); }
}
async function addVariant(aid) {
  const body = { article_id: aid, color: val("vc_" + aid), size: val("vs_" + aid),
    price: val("vp_" + aid) ? Number(val("vp_" + aid)) : null, qty: val("vq_" + aid) || 0 };
  if (!body.color && !body.size) return toast("Add a colour or size");
  const { ok } = await api("/api/admin/variants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { toast("Added"); loadArticles(); }
}
async function delVariant(id) {
  const { ok } = await api("/api/admin/variants?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Removed"); loadArticles(); }
}
async function uploadPhoto(aid, input) {
  const file = input.files[0]; if (!file) return;
  toast("Uploading…");
  const small = await compressImage(file);
  const fd = new FormData(); fd.append("file", small); fd.append("article_id", aid);
  const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
  if (res.ok) { toast("Photo added"); loadArticles(); } else toast("Upload failed");
}
async function delPhoto(id) {
  const { ok } = await api("/api/admin/photos?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Photo removed"); loadArticles(); }
}

// ---- links ----
async function createLink() {
  const body = { label: lk_label.value.trim(), phone: lk_phone.value.trim(), hours: lk_hours.value };
  const { ok, data } = await api("/api/admin/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!ok || !data.link) return toast("Failed");
  const wa = body.phone ? "https://wa.me/" + body.phone.replace(/[^0-9]/g, "") + "?text=" +
    encodeURIComponent("Here is your catalogue (valid a few hours):\n" + data.link + "\nAdd items to your cart and send your order back here.") : "";
  document.getElementById("linkResult").innerHTML =
    '<div class="card artcard"><label>New link (share with the customer)</label>' +
    '<div class="chiplink" id="theLink">' + esc(data.link) + '</div>' +
    '<div class="row-actions" style="margin-top:8px">' +
    '<button class="btn sm" onclick="copyLink()">Copy link</button>' +
    (wa ? '<a class="btn amber sm" href="' + wa + '" target="_blank">Send on WhatsApp</a>' : '') +
    '</div></div>';
  lk_label.value = lk_phone.value = "";
  loadLinks();
}
function copyLink() { navigator.clipboard.writeText(document.getElementById("theLink").textContent).then(() => toast("Copied")); }

async function loadLinks() {
  const { data } = await api("/api/admin/tokens");
  if (!data || data.error) return;
  const now = data.now;
  const el = document.getElementById("linkList");
  if (!data.tokens.length) { el.innerHTML = '<p class="muted">No links yet.</p>'; return; }
  el.innerHTML = '<table><thead><tr><th>Customer</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>' +
    data.tokens.map((t) => {
      const expired = t.is_revoked || now > t.expires_at;
      const status = t.is_revoked ? '<span class="expired">Revoked</span>' : (expired ? '<span class="expired">Expired</span>' : '<span class="live">Active</span>');
      return '<tr><td>' + esc(t.customer_label || "—") + '<br><span class="muted" style="font-size:12px">' + esc(t.customer_phone || "") + '</span></td>' +
        '<td>' + status + '</td><td>' + fmt(t.expires_at) + '</td>' +
        '<td>' + (expired ? '' : '<button class="btn danger sm" onclick="revoke(' + jq(t.id) + ')">Revoke</button>') + '</td></tr>';
    }).join("") + '</tbody></table>';
}
async function revoke(id) {
  const { ok } = await api("/api/admin/tokens", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  if (ok) { toast("Revoked"); loadLinks(); }
}

// ---- orders ----
async function loadOrders() {
  const { data } = await api("/api/admin/orders");
  if (!data || data.error) return;
  const cur = SETTINGS.currency || "Rs.";
  const el = document.getElementById("orderList");
  if (!data.orders.length) { el.innerHTML = '<p class="muted">No orders yet.</p>'; return; }
  el.innerHTML = '<table><thead><tr><th>When</th><th>Customer</th><th>Items</th><th>Est. total</th></tr></thead><tbody>' +
    data.orders.map((o) => '<tr><td>' + fmt(o.created_at) + '</td><td>' + esc(o.customer_label || "—") + '</td><td>' + o.item_count + '</td><td>' + esc(cur) + (o.est_total || 0) + '</td></tr>').join("") +
    '</tbody></table>';
}

// ---- utils ----
function authFail(data) {
  if (data && data.error === "auth") {
    document.querySelector(".wrap").innerHTML = '<div class="notice card"><h2>Not signed in</h2><p class="muted">Sign in through Cloudflare Access to manage the shop. (During local testing set DEV="1".)</p></div>';
  }
}
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function jq(s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; }
function fmt(ms) { const d = new Date(Number(ms)); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

loadAll();
