let ARTICLES = [];
let SETTINGS = {};
let CAT_IMAGES = {};
let CATEGORIES = [];

// ---- tabs ----
document.getElementById("tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "p-" + t.dataset.p));
});

async function loadAll() {
  await Promise.all([loadSettings(), loadArticles()]);
  loadLinks(); loadOrders(); loadBanners(); loadCategories();
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
  if (document.getElementById("st_about")) document.getElementById("st_about").value = SETTINGS.about_us || "";
  if (document.getElementById("st_ig")) document.getElementById("st_ig").value = SETTINGS.instagram_url || "";
  if (document.getElementById("st_fb")) document.getElementById("st_fb").value = SETTINGS.facebook_url || "";
}
async function saveSettings() {
  const body = {
    shop_name: st_name.value, owner_phone: st_phone.value, currency: st_cur.value,
    default_link_hours: st_hours.value, show_prices: st_show.value,
    about_us: (document.getElementById("st_about") || {}).value || "",
    instagram_url: (document.getElementById("st_ig") || {}).value || "",
    facebook_url: (document.getElementById("st_fb") || {}).value || "",
  };
  const { ok, data } = await api("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { SETTINGS = data.settings; toast("Settings saved"); document.getElementById("hdrName").textContent = (SETTINGS.shop_name || "Shop") + " — Admin"; }
  else toast("Save failed");
}

// ---- articles + stock ----
async function loadArticles() {
  const [artRes, catImgRes] = await Promise.all([api("/api/admin/articles"), api("/api/admin/category-images")]);
  if (!artRes.data || artRes.data.error) return authFail(artRes.data);
  ARTICLES = artRes.data.articles || [];
  const rows = (catImgRes.data && catImgRes.data.category_images) || [];
  CAT_IMAGES = {};
  rows.forEach(r => { CAT_IMAGES[r.category] = r.image_url; });
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
  // banner link datalist: categories + article codes
  const bnrList = document.getElementById("bnrLinkList");
  if (bnrList) {
    bnrList.innerHTML =
      cats.map(c => '<option value="' + esc(c) + '" label="Category: ' + esc(c) + '">').join("") +
      ARTICLES.map(a => '<option value="' + esc(a.article_code) + '" label="' + esc(a.article_code) + ' — ' + esc(a.name || '') + '">').join("");
  }
}

function renderArticles() {
  const cur = SETTINGS.currency || "Rs.";
  const el = document.getElementById("artList");
  if (!ARTICLES.length) { el.innerHTML = '<p class="muted">No articles yet.</p>'; return; }
  el.innerHTML = ARTICLES.map((a) => {
    const vs = a.variants.map((v) =>
      '<div class="line">' +
        '<div style="flex:1;min-width:80px;font-size:13px">' + esc(v.color || '–') + ' · ' + esc(v.size || '–') + '</div>' +
        '<input type="number" id="vq2_' + v.id + '" value="' + v.available_qty + '" placeholder="Qty" style="width:62px;padding:5px 6px">' +
        '<input type="number" id="vp2_' + v.id + '" value="' + (v.price != null ? v.price : '') + '" placeholder="Price" style="width:76px;padding:5px 6px">' +
        '<button class="btn sm ghost" style="padding:5px 8px;flex-shrink:0" onclick="saveVariant(' + jq(v.id) + ')">✓</button>' +
        '<span class="x" style="flex-shrink:0;margin-left:0" onclick="delVariant(' + jq(v.id) + ')">✕</span>' +
      '</div>').join("") || '<p class="muted" style="font-size:13px">No colours/sizes yet.</p>';
    const photos = (a.photos || []).map((p) =>
      '<div class="t">' +
        '<img src="' + esc(p.url) + '">' +
        (p.color ? '<div style="font-size:10px;text-align:center;color:var(--muted)">' + esc(p.color) + '</div>' : '') +
        '<span class="rm" onclick="delPhoto(' + jq(p.id) + ')">✕</span>' +
      '</div>').join("");

    // known colors for this article
    const knownColors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
    const colorOpts = knownColors.map(c => '<option>' + esc(c) + '</option>').join('');

    return '<div class="card artcard">' +
      // ── header ──
      '<div class="hd">' +
        '<div><strong>' + esc(a.article_code) + '</strong> — ' + esc(a.name || "") + ' <span class="tag">' + esc(a.category) + '</span></div>' +
        '<div class="row-actions">' +
          '<button class="btn sm ghost" onclick="toggleEdit(' + jq(a.id) + ')">Edit</button>' +
          '<button class="btn danger sm" onclick="delArticle(' + jq(a.id) + ')">Delete</button>' +
        '</div>' +
      '</div>' +
      // ── inline edit form ──
      '<div id="ef-' + a.id + '" style="display:none;border-top:1px solid var(--line);padding-top:12px;margin-bottom:10px">' +
        '<div class="grid2">' +
          '<div class="field"><label>Article Code</label><input id="ec_' + a.id + '" value="' + esc(a.article_code) + '"></div>' +
          '<div class="field"><label>Name</label><input id="en_' + a.id + '" value="' + esc(a.name || "") + '"></div>' +
          '<div class="field"><label>Category</label><input id="ect_' + a.id + '" value="' + esc(a.category || "") + '" list="catList"></div>' +
          '<div class="field"><label>Base Price</label><input id="ebp_' + a.id + '" type="number" value="' + (a.base_price ?? "") + '"></div>' +
        '</div>' +
        '<div class="field"><label>Description</label><textarea id="edd_' + a.id + '" rows="2" style="resize:vertical">' + esc(a.description || "") + '</textarea></div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
          '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:normal"><input type="checkbox" id="ea_' + a.id + '" ' + (a.is_active ? "checked" : "") + ' style="width:auto"> Active</label>' +
          '<button class="btn sm" onclick="saveArticle(' + jq(a.id) + ')">Save changes</button>' +
          '<button class="btn sm ghost" onclick="toggleEdit(' + jq(a.id) + ')">Cancel</button>' +
        '</div>' +
      '</div>' +
      // ── variants + photos ──
      '<div class="grid2"><div>' +
        '<div style="margin-bottom:8px">' + vs + '</div>' +
        '<div class="row-actions" style="align-items:end">' +
          '<div style="width:100px"><label>Colour</label><input id="vc_' + a.id + '" list="artColors_' + a.id + '"><datalist id="artColors_' + a.id + '">' + colorOpts + '</datalist></div>' +
          '<div style="width:80px"><label>Size</label><input id="vs_' + a.id + '"></div>' +
          '<div style="width:88px"><label>Price</label><input id="vp_' + a.id + '" type="number"></div>' +
          '<div style="width:75px"><label>Qty</label><input id="vq_' + a.id + '" type="number" value="0"></div>' +
          '<button class="btn sm" onclick="addVariant(' + jq(a.id) + ')">Add</button>' +
        '</div></div>' +
      '<div>' +
        '<label>Photos</label>' +
        '<div class="thumbs">' + photos + '</div>' +
        '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:10px">' +
          '<div style="width:130px"><label>Photo colour</label>' +
            '<select id="pc_' + a.id + '"><option value="">— any —</option>' + colorOpts + '</select>' +
          '</div>' +
          '<div><label>Choose photos</label><input type="file" accept="image/*" multiple onchange="uploadPhoto(' + jq(a.id) + ',this)"></div>' +
        '</div>' +
        '<p class="muted" style="font-size:12px;margin-top:6px">Tag each photo with its colour so customers see the right image when they switch colour.</p>' +
      '</div></div></div>';
  }).join("");
}

function toggleEdit(id) {
  const el = document.getElementById("ef-" + id);
  el.style.display = el.style.display === "none" ? "block" : "none";
}

async function saveArticle(id) {
  const body = {
    id,
    article_code: val("ec_" + id),
    name:         val("en_" + id),
    category:     val("ect_" + id),
    base_price:   val("ebp_" + id) ? Number(val("ebp_" + id)) : null,
    description:  (document.getElementById("edd_" + id) || {}).value?.trim() || "",
    is_active:    !!(document.getElementById("ea_" + id) || {}).checked,
  };
  if (!body.article_code || !body.category) return toast("Code and category are required");
  const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { toast("Article updated"); toggleEdit(id); loadArticles(); }
  else toast("Save failed");
}

function toggleAdd() { const f = document.getElementById("addForm"); f.style.display = f.style.display === "none" ? "block" : "none"; }

async function createArticle() {
  const body = { article_code: na_code.value.trim(), name: na_name.value.trim(), category: na_cat.value.trim(),
    description: na_desc.value.trim() };
  if (!body.article_code || !body.category) return toast("Code and category are required");
  const { ok } = await api("/api/admin/articles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { toast("Article added"); na_code.value = na_name.value = na_cat.value = na_desc.value = ""; toggleAdd(); loadArticles(); }
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
async function saveVariant(vid) {
  const qEl = document.getElementById('vq2_' + vid);
  const pEl = document.getElementById('vp2_' + vid);
  let isActive = 1;
  let varRef = null;
  for (const a of ARTICLES) { const v = a.variants.find(x => x.id === vid); if (v) { isActive = v.is_active ? 1 : 0; varRef = v; break; } }
  const newQty = qEl ? Number(qEl.value) : 0;
  const newPrice = pEl && pEl.value.trim() !== '' ? Number(pEl.value) : null;
  const { ok } = await api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates: [{ id: vid, available_qty: newQty, price: newPrice, is_active: isActive }] }) });
  if (ok) { toast("Saved"); if (varRef) { varRef.available_qty = newQty; varRef.price = newPrice; } }
  else toast("Save failed");
}
async function uploadPhoto(aid, input) {
  const files = [...input.files]; if (!files.length) return;
  const color = val("pc_" + aid);
  toast("Uploading " + files.length + " photo(s)…");
  for (const file of files) {
    const small = await compressImage(file);
    const fd = new FormData(); fd.append("file", small); fd.append("article_id", aid);
    if (color) fd.append("color", color);
    const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
    if (!res.ok) { toast("Upload failed"); loadArticles(); return; }
  }
  toast(files.length + " photo(s) added"); loadArticles();
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

// ---- banners ----
async function loadBanners() {
  const { data } = await api("/api/admin/banners");
  if (!data || data.error) return;
  const banners = data.banners || [];
  const el = document.getElementById("bannerList");
  if (!el) return;
  if (!banners.length) { el.innerHTML = '<p class="muted">No banners yet. Upload one above.</p>'; }
  else {
    el.innerHTML = banners.map(b =>
      '<div class="banner-item">' +
        '<div class="banner-thumb"><img src="' + esc(b.image_url) + '" alt=""></div>' +
        '<div class="banner-info">' +
          '<label>Link (category name or URL)</label>' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
            '<input class="banner-link-input" id="bl_' + b.id + '" value="' + esc(b.link_url || '') + '" placeholder="e.g. Handbag">' +
            '<button class="btn sm" onclick="saveBannerLink(' + jq(b.id) + ')">Save</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:normal">' +
              '<input type="checkbox" ' + (b.is_active ? 'checked' : '') + ' onchange="setBannerActive(' + jq(b.id) + ',this.checked)" style="width:auto"> Visible' +
            '</label>' +
            '<button class="btn danger sm" onclick="deleteBanner(' + jq(b.id) + ')">Delete</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');
  }
  renderCatImgList();
}

async function uploadBanner() {
  const fileInput = document.getElementById("bnr_file");
  const link = document.getElementById("bnr_link").value.trim();
  if (!fileInput.files.length) return toast("Choose a photo first");
  const file = await compressImage(fileInput.files[0], 1600, 0.85);
  toast("Uploading…");
  const fd = new FormData(); fd.append("file", file); fd.append("link_url", link);
  const res = await fetch("/api/admin/banners", { method: "POST", body: fd });
  if (!res.ok) return toast("Upload failed");
  toast("Banner added");
  fileInput.value = "";
  document.getElementById("bnr_link").value = "";
  document.getElementById("bnr_preview").style.display = "none";
  loadBanners();
}

async function saveBannerLink(id) {
  const val = document.getElementById("bl_" + id)?.value || "";
  const { ok } = await api("/api/admin/banners", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, link_url: val }) });
  if (ok) toast("Saved"); else toast("Failed");
}

async function setBannerActive(id, active) {
  await api("/api/admin/banners", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, is_active: active }) });
}

async function deleteBanner(id) {
  if (!confirm("Delete this banner?")) return;
  const { ok } = await api("/api/admin/banners?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Deleted"); loadBanners(); } else toast("Failed");
}

// Banner file preview
document.addEventListener("DOMContentLoaded", () => {
  const fi = document.getElementById("bnr_file");
  if (fi) fi.addEventListener("change", () => {
    if (!fi.files.length) return;
    const url = URL.createObjectURL(fi.files[0]);
    document.getElementById("bnr_preview_img").src = url;
    document.getElementById("bnr_preview").style.display = "block";
  });
});

// ---- category images ----
function renderCatImgList() {
  const el = document.getElementById("catImgList");
  if (!el) return;
  const cats = [...new Set(ARTICLES.map(a => a.category).filter(Boolean))];
  if (!cats.length) { el.innerHTML = '<p class="muted">No categories yet. Add articles first.</p>'; return; }
  el.innerHTML = cats.map(c => {
    const img = CAT_IMAGES[c];
    return '<div class="cat-img-item">' +
      '<div class="cat-img-thumb">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(c) + '">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted)">No image</div>') +
      '</div>' +
      '<div style="flex:1"><strong style="font-size:13px">' + esc(c) + '</strong>' +
        (img ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">Image set</div>' : '<div style="font-size:11px;color:var(--muted);margin-top:2px">No image set</div>') +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<label class="btn sm ghost" style="cursor:pointer;margin:0">Upload<input type="file" accept="image/*" style="display:none;width:0" onchange="uploadCatImg(' + jq(c) + ',this)"></label>' +
        (img ? '<button class="btn danger sm" onclick="deleteCatImg(' + jq(c) + ')">Remove</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

async function uploadCatImg(category, input) {
  if (!input.files.length) return;
  const file = await compressImage(input.files[0], 800, 0.85);
  toast("Uploading…");
  const fd = new FormData(); fd.append("file", file); fd.append("category", category);
  const res = await fetch("/api/admin/category-images", { method: "POST", body: fd });
  if (!res.ok) return toast("Upload failed");
  const data = await res.json();
  CAT_IMAGES[category] = data.image_url;
  toast("Image saved");
  renderCatImgList();
}

async function deleteCatImg(category) {
  const { ok } = await api("/api/admin/category-images?category=" + encodeURIComponent(category), { method: "DELETE" });
  if (ok) { delete CAT_IMAGES[category]; toast("Removed"); renderCatImgList(); }
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
