let ARTICLES = [];
let SETTINGS = {};
let CAT_IMAGES = {};
let CATEGORIES = [];
let NAV_CATS = []; // admin-chosen header categories, in order (max 10)
let WIZARD_AID = null;
let EDIT_MODAL_AID = null;
let AUTH_FAIL_FIRED = false; // guard: only run authFail logic once

// Any api() call that hits a CF Access redirect fires this event.
window.addEventListener("apiauthfail", e => authFail(e.detail));

// ---- tabs ----
document.getElementById("tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "p-" + t.dataset.p));
});

async function loadAll() {
  AUTH_FAIL_FIRED = false;
  try {
    await Promise.all([loadSettings(), loadArticles()]);
  } catch (_) {
    authFail({ error: "auth", reason: "no_session" });
    return;
  }
  if (AUTH_FAIL_FIRED) return; // auth failed inside one of the loaders
  loadLinks(); loadOrders(); loadBanners(); loadCategories();
}

// ---- settings ----
async function loadSettings() {
  const { data } = await api("/api/admin/settings");
  if (!data) return; // timeout — loadArticles will show retry button
  if (data.error) return authFail(data);
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
  NAV_CATS = (SETTINGS.nav_categories || "").split(",").map(s => s.trim()).filter(Boolean);
  renderBranding();
  applyBranding({ logo_url: SETTINGS.logo_url, favicon_url: SETTINGS.favicon_url, name: SETTINGS.shop_name });
}

// ---- branding (logo + favicon) ----
function renderBranding() {
  const logoEl = document.getElementById("logoPreview");
  if (logoEl) {
    logoEl.innerHTML = SETTINGS.logo_url
      ? '<img src="' + esc(SETTINGS.logo_url) + '" alt="logo">' +
        '<button class="btn danger sm" onclick="removeBranding(\'logo\')">Remove</button>'
      : '<span class="muted" style="font-size:12px">No custom logo — using default.</span>';
  }
  const favEl = document.getElementById("faviconPreview");
  if (favEl) {
    favEl.innerHTML = SETTINGS.favicon_url
      ? '<img src="' + esc(SETTINGS.favicon_url) + '" alt="favicon">' +
        '<button class="btn danger sm" onclick="removeBranding(\'favicon\')">Remove</button>'
      : '<span class="muted" style="font-size:12px">No custom favicon — using default.</span>';
  }
}
async function uploadBranding(kind, input) {
  if (!input.files.length) return;
  const file = input.files[0];
  input.value = "";
  // PNG output preserves transparency for logo/favicon. "Use original" keeps the whole image.
  const opts = kind === "favicon"
    ? { ratio: 1, title: "Crop favicon", ratioLabel: "Browser icon — square 1:1", maxEdge: 512, type: "image/png", quality: 1, name: "favicon" }
    : { ratio: 3, title: "Crop logo", ratioLabel: "Header logo — trim empty space or use original", maxEdge: 600, type: "image/png", quality: 1, name: "logo" };
  openCropper(file, opts, async (cropped) => {
    toast("Uploading…");
    const fd = new FormData();
    fd.append("file", cropped);
    fd.append("kind", kind);
    const res = await fetch("/api/admin/branding", { method: "POST", body: fd });
    if (!res.ok) return toast("Upload failed");
    const data = await res.json();
    if (kind === "logo") SETTINGS.logo_url = data.url; else SETTINGS.favicon_url = data.url;
    toast((kind === "logo" ? "Logo" : "Favicon") + " updated");
    renderBranding();
    applyBranding({ logo_url: SETTINGS.logo_url, favicon_url: SETTINGS.favicon_url, name: SETTINGS.shop_name });
  });
}
async function removeBranding(kind) {
  const { ok } = await api("/api/admin/branding?kind=" + kind, { method: "DELETE" });
  if (!ok) return toast("Failed");
  if (kind === "logo") SETTINGS.logo_url = ""; else SETTINGS.favicon_url = "";
  toast("Removed — default will show after refresh");
  renderBranding();
}

// ---- image cropper (fixed-ratio frame; drag + zoom the image inside it) ----
// openCropper(file, opts, onDone, onCancel)
//   opts: { ratio (w/h), title, ratioLabel, maxEdge, type, quality, name,
//           deviceCrops:[{name,ratio}] — optional; draws a "safe area" showing
//           what stays visible across those target aspect ratios }
//   onDone(File)  — the cropped (or original) image, ready to upload
function openCropper(file, opts, onDone, onCancel) {
  const ratio = opts.ratio || 1;
  const maxEdge = opts.maxEdge || 1400;
  const type = opts.type || "image/jpeg";
  const quality = opts.quality != null ? opts.quality : 0.85;
  const objURL = URL.createObjectURL(file);
  const img = new Image();

  img.onerror = () => { URL.revokeObjectURL(objURL); toast("Could not read that image"); if (onCancel) onCancel(); };
  img.onload = () => {
    const natW = img.naturalWidth, natH = img.naturalHeight;
    const MAXW = Math.min(520, window.innerWidth - 60);
    const MAXH = Math.min(430, window.innerHeight - 250);
    let fw = MAXW, fh = fw / ratio;
    if (fh > MAXH) { fh = MAXH; fw = fh * ratio; }
    fw = Math.round(fw); fh = Math.round(fh);

    const baseScale = Math.max(fw / natW, fh / natH);
    let scale = baseScale, ox = (fw - natW * scale) / 2, oy = (fh - natH * scale) / 2;

    const modal = document.createElement("div");
    modal.className = "crop-modal";
    modal.innerHTML =
      '<div class="crop-dialog">' +
        '<div class="crop-head"><span class="crop-title">' + esc(opts.title || "Crop image") + '</span>' +
          '<button class="crop-x" aria-label="Close">✕</button></div>' +
        (opts.ratioLabel ? '<div class="crop-note">' + esc(opts.ratioLabel) + ' — drag to reposition, use the slider to zoom.</div>' : '') +
        '<div class="crop-stage" style="width:' + fw + 'px;height:' + fh + 'px">' +
          '<img alt=""><div class="crop-grid"></div>' +
        '</div>' +
        '<div class="crop-controls">' +
          '<span style="font-size:16px">−</span>' +
          '<input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1">' +
          '<span style="font-size:16px">+</span>' +
        '</div>' +
        '<div class="crop-foot">' +
          '<button class="btn ghost sm crop-original">Use original</button>' +
          '<div style="flex:1"></div>' +
          '<button class="btn ghost sm crop-cancel">Cancel</button>' +
          '<button class="btn crop-apply">Crop &amp; use</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const stage = modal.querySelector(".crop-stage");
    const imgEl = modal.querySelector(".crop-stage img");
    const zoom = modal.querySelector(".crop-zoom");
    imgEl.src = objURL;
    imgEl.style.width = natW + "px";
    imgEl.style.height = natH + "px";

    // Responsive "safe area": the crop is one image but is shown at different
    // aspect ratios per device (object-fit:cover), so edges get cut. Draw the
    // region that stays visible on EVERY device and dim what falls outside it.
    if (Array.isArray(opts.deviceCrops) && opts.deviceCrops.length) {
      let insetX = 0, insetY = 0;
      opts.deviceCrops.forEach((dc) => {
        if (dc.ratio > ratio)      insetY = Math.max(insetY, (1 - ratio / dc.ratio) / 2); // wider device → top/bottom cut
        else if (dc.ratio < ratio) insetX = Math.max(insetX, (1 - dc.ratio / ratio) / 2); // narrower device → sides cut
      });
      const safe = document.createElement("div");
      safe.className = "crop-safe";
      safe.style.left = safe.style.right = (insetX * 100) + "%";
      safe.style.top = safe.style.bottom = (insetY * 100) + "%";
      safe.innerHTML = '<span class="crop-safe-tag">Safe on all screens</span>';
      stage.appendChild(safe);
    }

    function clamp() {
      const dw = natW * scale, dh = natH * scale;
      ox = Math.min(0, Math.max(fw - dw, ox));
      oy = Math.min(0, Math.max(fh - dh, oy));
    }
    function render() { imgEl.style.transform = "translate(" + ox + "px," + oy + "px) scale(" + scale + ")"; }
    function setZoom(z) {
      const ix = (fw / 2 - ox) / scale, iy = (fh / 2 - oy) / scale;
      scale = baseScale * z;
      ox = fw / 2 - ix * scale; oy = fh / 2 - iy * scale;
      clamp(); render();
    }
    clamp(); render();

    let dragging = false, px = 0, py = 0;
    stage.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; py = e.clientY; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", (e) => { if (!dragging) return; ox += e.clientX - px; oy += e.clientY - py; px = e.clientX; py = e.clientY; clamp(); render(); });
    const stop = (e) => { dragging = false; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} };
    stage.addEventListener("pointerup", stop);
    stage.addEventListener("pointercancel", stop);
    zoom.addEventListener("input", () => setZoom(parseFloat(zoom.value)));
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const z = Math.min(4, Math.max(1, parseFloat(zoom.value) + (e.deltaY < 0 ? 0.12 : -0.12))); zoom.value = z; setZoom(z); }, { passive: false });

    function cleanup() { URL.revokeObjectURL(objURL); modal.remove(); document.body.style.overflow = ""; }
    function exportRegion(sx, sy, sw, sh) {
      let ow = sw, oh = sh, m = Math.max(ow, oh);
      if (m > maxEdge) { const k = maxEdge / m; ow *= k; oh *= k; }
      ow = Math.max(1, Math.round(ow)); oh = Math.max(1, Math.round(oh));
      const c = document.createElement("canvas"); c.width = ow; c.height = oh;
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
      c.toBlob((blob) => {
        const ext = type === "image/png" ? ".png" : ".jpg";
        const out = new File([blob], (opts.name || "image") + ext, { type });
        cleanup(); onDone(out);
      }, type, quality);
    }

    modal.querySelector(".crop-apply").onclick = () => exportRegion(-ox / scale, -oy / scale, fw / scale, fh / scale);
    modal.querySelector(".crop-original").onclick = () => exportRegion(0, 0, natW, natH);
    const cancel = () => { cleanup(); if (onCancel) onCancel(); };
    modal.querySelector(".crop-cancel").onclick = cancel;
    modal.querySelector(".crop-x").onclick = cancel;
  };
  img.src = objURL;
}

// Crop several files one after another (used for multi-photo uploads).
function cropFilesSequentially(files, opts, uploadOne, done) {
  let i = 0;
  const next = () => {
    if (i >= files.length) { if (done) done(); return; }
    const f = files[i++];
    openCropper(f, opts, async (cropped) => { await uploadOne(cropped); next(); }, next);
  };
  next();
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
  if (!artRes.data) {
    const el = document.getElementById("stockTable");
    if (el) el.innerHTML =
      '<p style="color:#555;font-size:14px">Took too long to load — the server may be waking up.' +
      ' <button class="btn sm" onclick="loadArticles()" style="margin-left:8px">Retry</button></p>';
    return;
  }
  if (artRes.data.error) return authFail(artRes.data);
  ARTICLES = (artRes.data.articles || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  const rows = (catImgRes.data && catImgRes.data.category_images) || [];
  CAT_IMAGES = {};
  rows.forEach(r => { CAT_IMAGES[r.category] = r.image_url; });
  renderStock(); renderCatList();
  if (EDIT_MODAL_AID) refreshEditModal();
}

function allVariants() {
  const rows = [];
  ARTICLES.forEach((a) => (a.variants || []).forEach((v) => rows.push({ a, v })));
  return rows;
}

// Determines whether a product is visible to customers, mirroring the catalog API
// rule: article active AND at least one active variant with qty > 0.
// Returns { live, reason } — reason explains what's missing when not live.
function stockLiveInfo(a) {
  const vs = a.variants || [];
  if (!vs.length) return { live: false, reason: "No colours/sizes yet — add one to go live." };
  if (!a.is_active) return { live: false, reason: 'Product is switched off — open Edit and tick "Active".' };
  const hasStock  = vs.some(v => (v.available_qty || 0) > 0);
  const hasActive = vs.some(v => v.is_active);
  if (vs.some(v => v.is_active && (v.available_qty || 0) > 0)) return { live: true };
  if (!hasStock)  return { live: false, reason: "Every colour is out of stock (qty 0) — set a stock quantity to go live." };
  if (!hasActive) return { live: false, reason: 'No colour is switched on — tick the "Live" box on a colour.' };
  return { live: false, reason: "Not visible to customers yet." };
}

function renderStock() {
  const cur = SETTINGS.currency || "Rs.";
  const el = document.getElementById("stockTable");
  if (!el) return;
  const rawQ = ((document.getElementById("stockSearch") || {}).value || "").trim().toLowerCase();
  const sortVal = ((document.getElementById("stockSort") || {}).value) || "newest";

  let articles = [...ARTICLES];
  if (sortVal === "az")       articles.sort((a, b) => (a.name || a.article_code || "").localeCompare(b.name || b.article_code || ""));
  else if (sortVal === "za")  articles.sort((a, b) => (b.name || b.article_code || "").localeCompare(a.name || a.article_code || ""));
  else if (sortVal === "oldest") articles.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  else if (sortVal === "category") articles.sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
  else articles.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)); // newest

  // Build rows per-article. Articles with NO variants still get a row so a newly
  // added product is always visible in Stock (it was previously invisible until a
  // colour/size was added).
  const allRows = [];
  articles.forEach(a => {
    const vs = a.variants || [];
    if (vs.length) vs.forEach(v => allRows.push({ a, v }));
    else allRows.push({ a, v: null });
  });

  const rows = allRows.filter(({ a }) =>
    !rawQ ||
    (a.article_code || "").toLowerCase().includes(rawQ) ||
    (a.name || "").toLowerCase().includes(rawQ) ||
    (a.category || "").toLowerCase().includes(rawQ)
  );
  if (!rows.length) {
    el.innerHTML = rawQ
      ? '<p class="muted">No results for that search.</p>'
      : '<p class="muted">No articles yet. Use <strong>Add Product</strong> to add one.</p>';
    return;
  }
  let lastAid = null;
  el.innerHTML =
    '<div class="tbl-wrap"><table><thead><tr><th>Bag</th><th>Colour</th><th>Size</th><th>Price (' + esc(cur) + ')</th><th>Qty</th><th>Live</th><th></th></tr></thead><tbody>' +
    rows.map(({ a, v }) => {
      // Status badge (Live/Not live) is shown once, on the first row of each article.
      const firstRow = a.id !== lastAid;
      lastAid = a.id;
      const info = stockLiveInfo(a);
      const badge = firstRow
        ? (info.live ? '<span class="live-badge">● Live</span>' : '<span class="notlive-badge">Not live</span>')
        : '';
      const reasonLine = (firstRow && !info.live && info.reason)
        ? '<div class="notlive-reason">' + esc(info.reason) + '</div>' : '';
      const editBtn = '<td><button class="btn sm ghost" style="padding:4px 10px;white-space:nowrap" onclick="openEditModal(' + jq(a.id) + ')">✏ Edit</button></td>';
      const bagCell = '<td><strong>' + esc(a.article_code) + '</strong>' + (badge ? ' ' + badge : '') +
        '<br><span class="muted" style="font-size:12px">' + esc(a.name || "") + '</span>' + reasonLine + '</td>';
      if (!v) {
        // Article with no colours/sizes yet — not live. Show it so it can be completed.
        return '<tr class="row-notlive">' + bagCell +
          '<td colspan="5"><span class="muted" style="font-size:12px">Click ✏ Edit to add a colour / size / price and a stock quantity.</span></td>' +
          editBtn + '</tr>';
      }
      return '<tr' + (info.live ? '' : ' class="row-notlive-soft"') + ' data-id="' + v.id + '">' + bagCell +
        '<td>' + esc(v.color || "") + '</td>' +
        '<td>' + esc(v.size || "") + '</td>' +
        '<td><input class="pricebox price-in" type="number" value="' + (v.price != null ? v.price : "") + '" placeholder="' + (a.base_price ?? "") + '"></td>' +
        '<td><input class="qtybox qty-in" type="number" value="' + v.available_qty + '"></td>' +
        '<td><input type="checkbox" class="act-in" ' + (v.is_active ? "checked" : "") + ' style="width:auto"></td>' +
        editBtn + '</tr>';
    }).join("") + '</tbody></table></div>';
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

// renderArticles kept as no-op (list is now in stock; edit via modal)
function renderArticles() {}

async function saveArticle(id) {
  const body = {
    id,
    article_code:   val("ec_" + id),
    name:           val("en_" + id),
    category:       val("ect_" + id),
    base_price:     val("ebp_" + id) ? Number(val("ebp_" + id)) : null,
    description:    (document.getElementById("edd_" + id) || {}).value?.trim() || "",
    is_active:      !!(document.getElementById("ea_" + id) || {}).checked,
    is_new_arrival: !!(document.getElementById("ena_" + id) || {}).checked,
  };
  if (!body.article_code || !body.category) return toast("Code and category are required");
  const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (ok) { toast("Article updated"); loadArticles(); }
  else toast("Save failed");
}

// ---- add-product wizard ----
function showWizard() {
  WIZARD_AID = null;
  document.getElementById("wzStart").style.display = "none";
  document.getElementById("wzContainer").style.display = "block";
  renderWizardStep1();
}
function hideWizard() {
  WIZARD_AID = null;
  document.getElementById("wzStart").style.display = "block";
  document.getElementById("wzContainer").style.display = "none";
  document.getElementById("wzContainer").innerHTML = "";
}
function renderWizardStep1() {
  const cur = SETTINGS.currency || "Rs.";
  // If we already created the article (e.g. user came Back from step 2), prefill it and edit in place.
  const a = WIZARD_AID ? (ARTICLES.find(x => x.id === WIZARD_AID) || {}) : {};
  const editing = !!WIZARD_AID;
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step on">1</span><span class="wz-step' + (editing ? ' done' : '') + '">2</span><span class="wz-step' + (editing ? ' done' : '') + '">3</span></div>' +
        '<h4 style="margin:0;flex:1">Basic Info</h4>' +
        '<button class="btn sm ghost" onclick="hideWizard()">Cancel</button>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="field"><label>Article Code *</label><input id="wz1_code" placeholder="BAG-1023" autocomplete="off" value="' + esc(a.article_code || "") + '"></div>' +
        '<div class="field"><label>Name</label><input id="wz1_name" placeholder="Ladies Handbag" value="' + esc(a.name || "") + '"></div>' +
        '<div class="field"><label>Category *</label><input id="wz1_cat" placeholder="Handbag" list="catList" value="' + esc(a.category || "") + '"></div>' +
        '<div class="field"><label>Price / piece (' + esc(cur) + ')</label><input id="wz1_price" type="number" placeholder="500" value="' + (a.base_price != null ? a.base_price : "") + '">' +
          '<p class="muted" style="font-size:11px;margin-top:4px;text-transform:none;letter-spacing:0;font-weight:400">Default price for every colour. In the next step you can leave each colour\'s price blank to use this, or override it only where a colour costs more.</p>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label>Description</label><textarea id="wz1_desc" rows="2" style="resize:vertical;width:100%;padding:8px;border:1px solid var(--line);font-family:inherit;font-size:14px;border-radius:2px">' + esc(a.description || "") + '</textarea></div>' +
      '<div class="row-actions" style="justify-content:flex-end">' +
        '<button class="btn" onclick="wzStep1Submit()">' + (editing ? 'Save &amp; Continue →' : 'Create &amp; Continue →') + '</button>' +
      '</div>' +
    '</div>';
  const el = document.getElementById("wz1_code"); if (el) el.focus();
}
async function wzStep1Submit() {
  const code = val("wz1_code"), name = val("wz1_name"), cat = val("wz1_cat");
  const desc = (document.getElementById("wz1_desc") || {}).value?.trim() || "";
  const price = val("wz1_price");
  if (!code) return toast("Article code is required");
  if (!cat) return toast("Category is required");
  // Exclude the article we're currently editing from the duplicate check.
  const duplicate = ARTICLES.find(a => a.id !== WIZARD_AID && (a.article_code || "").trim().toLowerCase() === code.toLowerCase());
  if (duplicate) {
    toast("❌ Article code \"" + code + "\" is already used by \"" + (duplicate.name || duplicate.article_code) + "\"");
    const el = document.getElementById("wz1_code");
    if (el) { el.style.border = "1.5px solid var(--danger,#dc3545)"; el.focus(); setTimeout(() => el.style.border = "", 2500); }
    return;
  }
  const basePrice = price ? Number(price) : null;

  if (WIZARD_AID) {
    // Editing the already-created article (came Back from a later step) — update in place.
    const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
    const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: WIZARD_AID, article_code: code, name, category: cat, description: desc,
        base_price: basePrice, is_active: a.is_active ? 1 : 0, is_new_arrival: a.is_new_arrival ? 1 : 0 }) });
    if (!ok) return toast("Failed to save changes");
    toast("Details saved");
    await loadArticles();
    renderWizardStep2();
    return;
  }

  const { ok, data } = await api("/api/admin/articles", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ article_code: code, name, category: cat, description: desc, base_price: basePrice }) });
  if (!ok) return toast("Failed to create article");
  WIZARD_AID = data.id;
  toast("Article created — now add colours & stock");
  await loadArticles();
  renderWizardStep2();
}
function renderWizardStep2() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
  const knownColors = [...new Set((a.variants || []).map(v => v.color).filter(Boolean))];
  const colorOpts = knownColors.map(c => '<option>' + esc(c) + '</option>').join('');
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step done">✓</span><span class="wz-step on">2</span><span class="wz-step">3</span></div>' +
        '<h4 style="margin:0;flex:1">Colours &amp; Stock — <strong>' + esc(a.article_code || "") + '</strong></h4>' +
        '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;cursor:pointer;font-weight:normal">' +
          '<input type="checkbox" id="wz2_na" ' + (a.is_new_arrival ? "checked" : "") + ' onchange="wzToggleNewArrival()" style="width:auto"> ⚡ New Arrival' +
        '</label>' +
      '</div>' +
      '<div id="wzVariantList" style="margin-bottom:16px"></div>' +
      '<div class="row-actions" style="align-items:flex-end;flex-wrap:wrap;gap:8px">' +
        '<div style="min-width:110px"><label>Colour</label><input id="wz2_vc" list="wzColors" autocomplete="off"><datalist id="wzColors">' + colorOpts + '</datalist></div>' +
        '<div style="min-width:78px"><label>Size</label><input id="wz2_vs"></div>' +
        '<div style="min-width:86px"><label>Price</label><input id="wz2_vp" type="number" placeholder="' + (a.base_price != null ? a.base_price : "Price") + '"></div>' +
        '<div style="min-width:68px"><label>Qty</label><input id="wz2_vq" type="number" value="1"></div>' +
        '<button class="btn sm" onclick="wzAddVariant()" style="align-self:flex-end">+ Add</button>' +
      '</div>' +
      '<div class="row-actions" style="justify-content:space-between;margin-top:16px;gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" onclick="renderWizardStep1()">← Back</button>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn ghost sm" onclick="wzStep3()">Skip to Photos</button>' +
          '<button class="btn" onclick="wzStep3()">Next: Photos →</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  renderWizardVariantList();
}
function renderWizardVariantList() {
  refreshWizardStatus();
  const el = document.getElementById("wzVariantList"); if (!el) return;
  const a = ARTICLES.find(x => x.id === WIZARD_AID);
  const vs = (a && a.variants) || [];
  const cur = SETTINGS.currency || "Rs.";
  if (!vs.length) { el.innerHTML = '<p class="muted" style="font-size:13px">No colours/sizes added yet.</p>'; return; }
  el.innerHTML = vs.map(v =>
    '<div class="line">' +
      '<span style="flex:1;font-size:13px">' +
        esc(v.color || "—") + (v.size ? ' · ' + esc(v.size) : '') +
        ' · ' + esc(cur) + (v.price != null ? v.price : (a.base_price ?? '?')) +
        ' · Qty: ' + v.available_qty +
      '</span>' +
      '<button class="btn sm ghost" style="padding:4px 8px;flex-shrink:0" onclick="wzDelVariant(' + jq(v.id) + ')">✕</button>' +
    '</div>'
  ).join("");
}
async function wzAddVariant() {
  if (!WIZARD_AID) return;
  const color = val("wz2_vc"), size = val("wz2_vs"), price = val("wz2_vp"), qty = val("wz2_vq") || 0;
  const isActive = 1; // new variants are always added live
  if (!color && !size) return toast("Enter a colour or size");
  const { ok } = await api("/api/admin/variants", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ article_id: WIZARD_AID, color, size, price: price ? Number(price) : null, qty: Number(qty), is_active: isActive }) });
  if (!ok) return toast("Failed");
  ["wz2_vc","wz2_vs","wz2_vp"].forEach(id => { const e = document.getElementById(id); if (e) e.value = ""; });
  const qEl = document.getElementById("wz2_vq"); if (qEl) qEl.value = "1";
  toast("Variant added");
  await loadArticles();
  renderWizardVariantList();
}
async function wzDelVariant(vid) {
  const { ok } = await api("/api/admin/variants?id=" + encodeURIComponent(vid), { method: "DELETE" });
  if (!ok) return toast("Failed");
  await loadArticles(); renderWizardVariantList();
}
async function wzToggleNewArrival() {
  if (!WIZARD_AID) return;
  const a = ARTICLES.find(x => x.id === WIZARD_AID); if (!a) return;
  const checked = (document.getElementById("wz2_na") || {}).checked;
  await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: WIZARD_AID, article_code: a.article_code, name: a.name, category: a.category,
      base_price: a.base_price, description: a.description, is_active: a.is_active, is_new_arrival: checked ? 1 : 0 }) });
}
// Live-status bar shown inside the wizard (steps 2 & 3). Reflects real customer
// visibility and offers a master ON/OFF (article is_active) toggle.
function wzStatusHTML() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID);
  if (!a) return '';
  const info = stockLiveInfo(a);
  const on = !(a.is_active === 0 || a.is_active === false);
  // If it's only hidden because the switch is off (but stock is ready), guide to the toggle.
  const readyButOff = !info.live && !a.is_active && (a.variants || []).some(v => v.is_active && (v.available_qty || 0) > 0);
  const msg = info.live
    ? 'This product is visible to customers.'
    : readyButOff
      ? 'Ready — turn on "Show to customers" to publish it.'
      : esc(info.reason);
  return '<div class="wz-status ' + (info.live ? 'on' : 'off') + '">' +
    '<div class="wz-status-main">' +
      '<span class="' + (info.live ? 'live-badge' : 'notlive-badge') + '">' + (info.live ? '● Live' : 'Not live') + '</span>' +
      '<span class="wz-status-msg">' + msg + '</span>' +
    '</div>' +
    '<label class="wz-live-toggle" title="Master on/off switch for this product">' +
      '<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="wzToggleActive(this.checked)"> Show to customers' +
    '</label>' +
  '</div>';
}
function refreshWizardStatus() {
  const el = document.getElementById("wzStatus");
  if (el) el.innerHTML = wzStatusHTML();
}
async function wzToggleActive(checked) {
  const a = ARTICLES.find(x => x.id === WIZARD_AID); if (!a) return;
  const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: WIZARD_AID, article_code: a.article_code, name: a.name, category: a.category,
      base_price: a.base_price, description: a.description, is_active: checked ? 1 : 0, is_new_arrival: a.is_new_arrival ? 1 : 0 }) });
  if (!ok) return toast("Failed");
  await loadArticles();
  refreshWizardStatus();
}

function wzStep3() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
  const knownColors = [...new Set((a.variants || []).map(v => v.color).filter(Boolean))];
  const colorOpts = knownColors.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step done">✓</span><span class="wz-step done">✓</span><span class="wz-step on">3</span></div>' +
        '<h4 style="margin:0;flex:1">Photos — <strong>' + esc(a.article_code || "") + '</strong></h4>' +
        '<span class="muted" style="font-size:13px">Optional</span>' +
      '</div>' +
      '<p class="muted" style="margin-bottom:12px;font-size:13px">Tag each photo with its colour so customers see the right image when they switch colour.</p>' +
      '<div class="thumbs" id="wzPhotoList">' + wzBuildPhotoThumbs(a) + '</div>' +
      '<div class="row-actions" style="align-items:flex-end;flex-wrap:wrap;gap:8px;margin-top:12px">' +
        '<div style="min-width:140px"><label>Photo colour</label><select id="wz3_pc"><option value="">— any colour —</option>' + colorOpts + '</select></div>' +
        '<div><label>Choose photos</label><input type="file" accept="image/*" multiple onchange="wzUploadPhoto(this)"></div>' +
      '</div>' +
      '<div id="wzStatus" class="wz-status-wrap" style="margin-top:20px"></div>' +
      '<div class="row-actions" style="justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:8px">' +
        '<button class="btn ghost sm" onclick="renderWizardStep2()">← Back</button>' +
        '<button class="btn" onclick="wzFinish()">✓ Done — View in Stock</button>' +
      '</div>' +
    '</div>';
  refreshWizardStatus();
}
function wzBuildPhotoThumbs(a) {
  return (a.photos || []).map(p =>
    '<div class="t"><img src="' + esc(p.url) + '">' +
      (p.color ? '<div style="font-size:10px;text-align:center;color:var(--muted)">' + esc(p.color) + '</div>' : '') +
      '<span class="rm" onclick="wzDelPhoto(' + jq(p.id) + ')">✕</span>' +
    '</div>'
  ).join('');
}
async function wzUploadPhoto(input) {
  if (!WIZARD_AID || !input.files.length) return;
  const color = (document.getElementById("wz3_pc") || {}).value || "";
  const files = [...input.files];
  input.value = "";
  cropFilesSequentially(files, { ratio: 1, title: "Crop product photo", ratioLabel: "Product photo — square 1:1", maxEdge: 1200, type: "image/jpeg", quality: 0.85, name: "photo" },
    async (file) => {
      const fd = new FormData(); fd.append("file", file); fd.append("article_id", WIZARD_AID);
      if (color) fd.append("color", color);
      const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
      if (!res.ok) toast("Upload failed");
    },
    async () => {
      toast("Photos added");
      await loadArticles();
      const el = document.getElementById("wzPhotoList");
      if (el) el.innerHTML = wzBuildPhotoThumbs(ARTICLES.find(x => x.id === WIZARD_AID) || {});
    });
}
async function wzDelPhoto(id) {
  const { ok } = await api("/api/admin/photos?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (!ok) return toast("Failed");
  await loadArticles();
  const el = document.getElementById("wzPhotoList");
  if (el) el.innerHTML = wzBuildPhotoThumbs(ARTICLES.find(x => x.id === WIZARD_AID) || {});
}
function wzFinish() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID);
  const info = a ? stockLiveInfo(a) : { live: false, reason: "" };
  WIZARD_AID = null;
  hideWizard();
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.p === "stock"));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id === "p-stock"));
  toast(info.live ? "✓ Product is LIVE — visible to customers." : "Saved, but NOT live yet: " + (info.reason || "add stock qty."));
}

// ---- edit modal ----
function openEditModal(aid) {
  EDIT_MODAL_AID = aid;
  document.getElementById("editModal").style.display = "block";
  document.body.style.overflow = "hidden";
  refreshEditModal();
}
function closeEditModal() {
  EDIT_MODAL_AID = null;
  document.getElementById("editModal").style.display = "none";
  document.body.style.overflow = "";
}
function refreshEditModal() {
  const a = ARTICLES.find(x => x.id === EDIT_MODAL_AID); if (!a) return;
  document.getElementById("editModalTitle").textContent = "Edit — " + a.article_code + (a.name ? " · " + a.name : "");
  document.getElementById("editModalBody").innerHTML = buildEditModalHTML(a);
}
function buildEditModalHTML(a) {
  const cur = SETTINGS.currency || "Rs.";
  const knownColors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const colorOpts = knownColors.map(c => '<option>' + esc(c) + '</option>').join('');
  const vs = a.variants.map(v =>
    '<div class="line">' +
      '<div style="flex:1;min-width:80px;font-size:13px">' + esc(v.color || '—') + ' · ' + esc(v.size || '—') + '</div>' +
      '<input type="number" id="vq2_' + v.id + '" value="' + v.available_qty + '" placeholder="Qty" style="width:62px;padding:5px 6px">' +
      '<input type="number" id="vp2_' + v.id + '" value="' + (v.price != null ? v.price : '') + '" placeholder="Price" style="width:76px;padding:5px 6px">' +
      '<button class="btn sm ghost" style="padding:5px 8px;flex-shrink:0" onclick="saveVariant(' + jq(v.id) + ')">✓</button>' +
      '<span class="x" style="flex-shrink:0;margin-left:0" onclick="delVariant(' + jq(v.id) + ')">✕</span>' +
    '</div>'
  ).join('') || '<p class="muted" style="font-size:13px">No colours/sizes yet.</p>';
  const photos = (a.photos || []).map(p =>
    '<div class="t"><img src="' + esc(p.url) + '">' +
      (p.color ? '<div style="font-size:10px;text-align:center;color:var(--muted)">' + esc(p.color) + '</div>' : '') +
      '<span class="rm" onclick="delPhoto(' + jq(p.id) + ')">✕</span>' +
    '</div>'
  ).join('');
  return (
    '<div style="margin-bottom:20px">' +
      '<h4 style="margin-bottom:12px">Article Info</h4>' +
      '<div class="grid2">' +
        '<div class="field"><label>Article Code</label><input id="ec_' + a.id + '" value="' + esc(a.article_code) + '"></div>' +
        '<div class="field"><label>Name</label><input id="en_' + a.id + '" value="' + esc(a.name || "") + '"></div>' +
        '<div class="field"><label>Category</label><input id="ect_' + a.id + '" value="' + esc(a.category || "") + '" list="catList"></div>' +
        '<div class="field"><label>Base Price (' + esc(cur) + ')</label><input id="ebp_' + a.id + '" type="number" value="' + (a.base_price ?? "") + '"></div>' +
      '</div>' +
      '<div class="field"><label>Description</label><textarea id="edd_' + a.id + '" rows="2" style="resize:vertical">' + esc(a.description || "") + '</textarea></div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:normal"><input type="checkbox" id="ea_' + a.id + '" ' + (a.is_active ? "checked" : "") + ' style="width:auto"> Active</label>' +
        '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:normal"><input type="checkbox" id="ena_' + a.id + '" ' + (a.is_new_arrival ? "checked" : "") + ' style="width:auto"> ⚡ New Arrival</label>' +
        '<button class="btn sm" onclick="saveArticle(' + jq(a.id) + ')">Save info</button>' +
        '<button class="btn danger sm" onclick="modalDelArticle(' + jq(a.id) + ')">Delete article</button>' +
      '</div>' +
    '</div>' +
    '<div style="border-top:1px solid var(--line);padding-top:16px;margin-bottom:20px">' +
      '<h4 style="margin-bottom:10px">Colours / Sizes</h4>' +
      '<div style="margin-bottom:10px">' + vs + '</div>' +
      '<div class="row-actions" style="align-items:flex-end;flex-wrap:wrap;gap:8px">' +
        '<div style="min-width:110px"><label>Colour</label><input id="vc_' + a.id + '" list="artColors_' + a.id + '"><datalist id="artColors_' + a.id + '">' + colorOpts + '</datalist></div>' +
        '<div style="min-width:78px"><label>Size</label><input id="vs_' + a.id + '"></div>' +
        '<div style="min-width:86px"><label>Price</label><input id="vp_' + a.id + '" type="number" placeholder="' + (a.base_price != null ? a.base_price : "Price") + '"></div>' +
        '<div style="min-width:68px"><label>Qty</label><input id="vq_' + a.id + '" type="number" value="1"></div>' +
        '<button class="btn sm" onclick="addVariant(' + jq(a.id) + ')">Add</button>' +
      '</div>' +
    '</div>' +
    '<div style="border-top:1px solid var(--line);padding-top:16px">' +
      '<h4 style="margin-bottom:10px">Photos</h4>' +
      '<div class="thumbs">' + photos + '</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:10px">' +
        '<div style="min-width:130px"><label>Photo colour</label>' +
          '<select id="pc_' + a.id + '"><option value="">— any —</option>' + colorOpts + '</select>' +
        '</div>' +
        '<div><label>Choose photos</label><input type="file" accept="image/*" multiple onchange="uploadPhoto(' + jq(a.id) + ',this)"></div>' +
      '</div>' +
      '<p class="muted" style="font-size:12px;margin-top:6px">Tag each photo with its colour.</p>' +
    '</div>'
  );
}
async function modalDelArticle(id) {
  if (!confirm("Delete this article and all its colours/photos?")) return;
  const { ok } = await api("/api/admin/articles?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Deleted"); closeEditModal(); loadArticles(); }
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
  input.value = "";
  cropFilesSequentially(files, { ratio: 1, title: "Crop product photo", ratioLabel: "Product photo — square 1:1", maxEdge: 1200, type: "image/jpeg", quality: 0.85, name: "photo" },
    async (file) => {
      const fd = new FormData(); fd.append("file", file); fd.append("article_id", aid);
      if (color) fd.append("color", color);
      const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
      if (!res.ok) toast("Upload failed");
    },
    () => { toast("Photos added"); loadArticles(); });
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
  el.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Customer</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>' +
    data.tokens.map((t) => {
      const expired = t.is_revoked || now > t.expires_at;
      const status = t.is_revoked ? '<span class="expired">Revoked</span>' : (expired ? '<span class="expired">Expired</span>' : '<span class="live">Active</span>');
      return '<tr><td>' + esc(t.customer_label || "—") + '<br><span class="muted" style="font-size:12px">' + esc(t.customer_phone || "") + '</span></td>' +
        '<td>' + status + '</td><td>' + fmt(t.expires_at) + '</td>' +
        '<td>' + (expired ? '' : '<button class="btn danger sm" onclick="revoke(' + jq(t.id) + ')">Revoke</button>') + '</td></tr>';
    }).join("") + '</tbody></table></div>';
}
async function revoke(id) {
  const { ok } = await api("/api/admin/tokens", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  if (ok) { toast("Revoked"); loadLinks(); }
}

// ---- orders ----
let ORDERS = [];
async function loadOrders() {
  const { data } = await api("/api/admin/orders");
  if (!data || data.error) return;
  ORDERS = data.orders || [];
  renderOrders();
}

function renderOrders() {
  const cur = SETTINGS.currency || "Rs.";
  const el = document.getElementById("orderList");
  if (!el) return;
  const q = ((document.getElementById("orderSearch") || {}).value || "").trim().toLowerCase();
  if (!ORDERS.length) { el.innerHTML = '<p class="muted">No orders yet.</p>'; return; }
  const rows = ORDERS.filter(o => !q || (o.customer_label || "").toLowerCase().includes(q));
  if (!rows.length) { el.innerHTML = '<p class="muted">No orders match that search.</p>'; return; }
  el.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Items</th><th>Est. total</th><th></th></tr></thead><tbody>' +
    rows.map((o) => '<tr><td>' + fmt(o.created_at) + '</td><td>' + esc(o.customer_label || "—") + '</td><td>' + o.item_count + '</td><td>' + esc(cur) + (o.est_total || 0) + '</td>' +
      '<td><button class="btn danger sm" onclick="deleteOrder(' + jq(o.id) + ')">Delete</button></td></tr>').join("") +
    '</tbody></table></div>';
}

async function deleteOrder(id) {
  if (!confirm("Delete this order from the log? (This does not affect WhatsApp.)")) return;
  const { ok } = await api("/api/admin/orders?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) {
    ORDERS = ORDERS.filter(o => o.id !== id);
    toast("Order deleted");
    renderOrders();
  } else toast("Failed");
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
        '<div class="banner-previews">' +
          '<div class="bp-box bp-desktop"><img src="' + esc(b.image_url) + '" alt=""><span class="bp-tag">Desktop</span></div>' +
          '<div class="bp-box bp-mobile"><img src="' + esc(b.image_url) + '" alt=""><span class="bp-tag">Mobile</span></div>' +
        '</div>' +
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
  const bannerRes = await api("/api/admin/banners");
  const currentCount = (bannerRes.data?.banners || []).length;
  if (currentCount >= 5) return toast("Maximum 5 banners allowed. Delete one first.");
  openCropper(fileInput.files[0], { ratio: 16 / 7, title: "Crop banner", ratioLabel: "Homepage banner. Phones crop the sides, desktop crops the top & bottom — keep the important part inside the dashed “Safe on all screens” box", maxEdge: 1600, type: "image/jpeg", quality: 0.85, name: "banner", deviceCrops: [{ name: "Mobile", ratio: 4 / 3 }, { name: "Desktop", ratio: 21 / 8 }] },
    async (file) => {
      toast("Uploading…");
      const fd = new FormData(); fd.append("file", file); fd.append("link_url", link);
      const res = await fetch("/api/admin/banners", { method: "POST", body: fd });
      if (!res.ok) return toast("Upload failed");
      toast("Banner added");
      fileInput.value = "";
      document.getElementById("bnr_link").value = "";
      document.getElementById("bnr_preview").style.display = "none";
      loadBanners();
    });
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
    const d = document.getElementById("bnr_prev_d"), m = document.getElementById("bnr_prev_m");
    if (d) d.src = url;
    if (m) m.src = url;
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
  const file = input.files[0];
  input.value = "";
  openCropper(file, { ratio: 4 / 3, title: "Crop category image", ratioLabel: "Category photo — 4:3 (used for the home tile and the category page header)", maxEdge: 1400, type: "image/jpeg", quality: 0.85, name: "category" },
    async (cropped) => {
      toast("Uploading…");
      const fd = new FormData(); fd.append("file", cropped); fd.append("category", category);
      const res = await fetch("/api/admin/category-images", { method: "POST", body: fd });
      if (!res.ok) return toast("Upload failed");
      const data = await res.json();
      CAT_IMAGES[category] = data.image_url;
      toast("Image saved");
      renderCatImgList();
    });
}

async function deleteCatImg(category) {
  const { ok } = await api("/api/admin/category-images?category=" + encodeURIComponent(category), { method: "DELETE" });
  if (ok) { delete CAT_IMAGES[category]; toast("Removed"); renderCatImgList(); }
}

// ---- categories ----
async function loadCategories() {
  const { data } = await api("/api/admin/categories");
  if (!data || data.error) return;
  CATEGORIES = data.categories || [];
  renderCatManager();
}

function showAddCatForm() {
  const f = document.getElementById("addCatForm");
  if (f) f.style.display = "block";
}
function hideAddCatForm() {
  const f = document.getElementById("addCatForm");
  if (f) f.style.display = "none";
  const inp = document.getElementById("new_cat_name");
  if (inp) inp.value = "";
}

async function createCategory() {
  const name = (document.getElementById("new_cat_name")?.value || "").trim();
  if (!name) return toast("Enter a category name");
  const { ok } = await api("/api/admin/categories", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name })
  });
  if (ok) { toast("Category created"); hideAddCatForm(); loadCategories(); loadArticles(); }
  else toast("Failed");
}

// ---- header menu (customer top nav) ----
function renderNavMenuEditor() {
  const el = document.getElementById("navMenuEditor");
  if (!el) return;
  const all = CATEGORIES.map(c => c.name);
  // Drop any chosen categories that no longer exist.
  NAV_CATS = NAV_CATS.filter(c => all.includes(c));
  const available = all.filter(c => !NAV_CATS.includes(c));

  const selectedHTML = NAV_CATS.length
    ? NAV_CATS.map((c, i) =>
        '<div class="line">' +
          '<span style="flex:1;font-size:13px"><strong>' + (i + 1) + '.</strong> ' + esc(c) + '</span>' +
          '<button class="btn sm ghost" style="padding:4px 9px" ' + (i === 0 ? "disabled" : "") + ' onclick="navMoveCat(' + i + ',-1)">↑</button>' +
          '<button class="btn sm ghost" style="padding:4px 9px" ' + (i === NAV_CATS.length - 1 ? "disabled" : "") + ' onclick="navMoveCat(' + i + ',1)">↓</button>' +
          '<span class="x" style="margin-left:0" onclick="navRemoveCat(' + jq(c) + ')">✕</span>' +
        '</div>'
      ).join("")
    : '<p class="muted" style="font-size:13px">No categories chosen — the first 10 will show automatically on the customer site.</p>';

  const addRow = (NAV_CATS.length < 10 && available.length)
    ? '<div class="row-actions" style="align-items:flex-end;gap:8px;margin-top:14px">' +
        '<div style="flex:1;min-width:160px"><label>Add category to header</label>' +
          '<select id="navAddSel">' + available.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join("") + '</select>' +
        '</div>' +
        '<button class="btn sm" onclick="navAddSelected()">+ Add</button>' +
      '</div>'
    : (NAV_CATS.length >= 10 ? '<p class="muted" style="font-size:12px;margin-top:12px">Maximum of 10 reached. Remove one to add another.</p>' : '');

  el.innerHTML =
    '<div>' + selectedHTML + '</div>' +
    addRow +
    '<div class="row-actions" style="justify-content:flex-end;margin-top:16px">' +
      '<button class="btn" onclick="saveNavCats()">Save header menu</button>' +
    '</div>';
}
function navAddSelected() {
  const sel = document.getElementById("navAddSel");
  if (!sel || !sel.value) return;
  if (NAV_CATS.length >= 10) return toast("Maximum of 10 categories");
  if (!NAV_CATS.includes(sel.value)) NAV_CATS.push(sel.value);
  renderNavMenuEditor();
}
function navRemoveCat(name) {
  NAV_CATS = NAV_CATS.filter(c => c !== name);
  renderNavMenuEditor();
}
function navMoveCat(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= NAV_CATS.length) return;
  const t = NAV_CATS[i]; NAV_CATS[i] = NAV_CATS[j]; NAV_CATS[j] = t;
  renderNavMenuEditor();
}
async function saveNavCats() {
  const { ok, data } = await api("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nav_categories: NAV_CATS.join(",") }) });
  if (ok) { SETTINGS = data.settings || SETTINGS; toast("Header menu saved"); } else toast("Save failed");
}

function renderCatManager() {
  renderNavMenuEditor();
  const el = document.getElementById("catManagerList");
  if (!el) return;
  if (!CATEGORIES.length) { el.innerHTML = '<p class="muted">No categories yet.</p>'; return; }
  // Use numeric index for IDs to avoid issues with spaces/special chars in category names
  el.innerHTML = CATEGORIES.map((c, i) =>
    '<div class="card artcard" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<div id="ci-label-' + i + '" style="flex:1;min-width:120px">' +
        '<strong>' + esc(c.name) + '</strong>' +
        ' <span class="muted" style="font-size:12px">' + c.article_count + ' article' + (c.article_count !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div id="ci-edit-' + i + '" style="display:none;flex:1;min-width:160px">' +
        '<input id="ci-inp-' + i + '" value="' + esc(c.name) + '" style="width:100%">' +
      '</div>' +
      '<div class="row-actions">' +
        '<button class="btn sm ghost" id="ci-btn-' + i + '" onclick="startRenameCategory(' + i + ')">Rename</button>' +
        '<button class="btn sm" id="ci-save-' + i + '" onclick="confirmRenameCategory(' + i + ',' + jq(c.name) + ')" style="display:none">Save</button>' +
        '<button class="btn sm ghost" id="ci-cancel-' + i + '" onclick="cancelRenameCategory(' + i + ')" style="display:none">Cancel</button>' +
        '<button class="btn danger sm" onclick="deleteCategory(' + jq(c.name) + ')">Delete</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function startRenameCategory(i) {
  document.getElementById('ci-label-' + i).style.display = 'none';
  document.getElementById('ci-edit-' + i).style.display = 'block';
  document.getElementById('ci-btn-' + i).style.display = 'none';
  document.getElementById('ci-save-' + i).style.display = '';
  document.getElementById('ci-cancel-' + i).style.display = '';
  const inp = document.getElementById('ci-inp-' + i);
  if (inp) { inp.focus(); inp.select(); }
}

function cancelRenameCategory(i) {
  document.getElementById('ci-label-' + i).style.display = '';
  document.getElementById('ci-edit-' + i).style.display = 'none';
  document.getElementById('ci-btn-' + i).style.display = '';
  document.getElementById('ci-save-' + i).style.display = 'none';
  document.getElementById('ci-cancel-' + i).style.display = 'none';
}

async function confirmRenameCategory(i, old_name) {
  const new_name = (document.getElementById('ci-inp-' + i) || {}).value || '';
  const trimmed = new_name.trim();
  if (!trimmed || trimmed === old_name) return cancelRenameCategory(i);
  const { ok } = await api('/api/admin/categories', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ old_name, new_name: trimmed })
  });
  if (ok) { toast('Renamed'); loadCategories(); loadArticles(); } else toast('Failed');
}

async function deleteCategory(name) {
  if (!confirm('Delete category "' + name + '"? Articles will move to Uncategorized.')) return;
  const { ok } = await api('/api/admin/categories', {
    method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name })
  });
  if (ok) { toast('Deleted'); loadCategories(); loadArticles(); } else toast('Failed');
}

// Sign in flow:
// /api/admin/login-bounce is protected by CF Access, so navigating to it triggers the
// CF Access login page. After the user authenticates, CF Access redirects back to
// login-bounce, which immediately 302s to /admin.html with the session cookie set.
function doSignIn() {
  window.location.href = '/api/admin/login-bounce';
}

// ---- utils ----
function authFail(data) {
  if (!data || data.error !== "auth") return;
  if (AUTH_FAIL_FIRED) return; // already handling it, don't race
  AUTH_FAIL_FIRED = true;

  const reason  = data.reason || "";
  const email   = data.email  || "";
  // ?_cf=1 means we already did one auto-redirect; don't loop, show the screen.
  const retried = new URLSearchParams(location.search).has("_cf");

  // For cf_redirect (CORS failure), do one reload to let CF Access intercept admin.html.
  // For everything else (timeout, no_session, expired) show the sign-in screen immediately.
  if (!retried && reason === "cf_redirect") {
    window.location.replace("/admin.html?_cf=1");
    return;
  }

  // Second pass (or wrong-account) — show the appropriate screen.
  let title, body, btnLabel;

  if (reason === "email_not_allowed") {
    title    = "Wrong account";
    body     = "You are signed in as <strong>" + email + "</strong>, but that email is not in the allowed list."
             + "<br><br>Click below to sign out and sign in with the correct account."
             + " If the correct email isn't added yet, update <code>ALLOWED_EMAILS</code> in Cloudflare Pages → Settings → Environment Variables.";
    btnLabel = "Sign out &amp; sign in again";
  } else if (reason === "expired") {
    title    = "Session expired";
    body     = (email ? "Your session for <strong>" + email + "</strong> has timed out." : "Your admin session has timed out.")
             + "<br><br>Click below to sign in again.";
    btnLabel = "Sign In";
  } else {
    title    = "Not signed in";
    body     = "No active admin session found. Click below to sign in through Cloudflare Access.";
    btnLabel = "Sign In";
  }

  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'min-height:100vh;font-family:inherit;padding:40px;background:#f8f9fa">' +
    '<div style="background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:48px 40px;max-width:420px;width:100%">' +
    '<h2 style="margin-bottom:12px;font-size:20px">' + title + '</h2>' +
    '<p style="color:#555;margin-bottom:28px;font-size:14px;line-height:1.6;text-align:left">' + body + '</p>' +
    '<button onclick="doSignIn()" style="background:#00a1e0;color:#fff;padding:12px 32px;' +
    'border:none;border-radius:2px;font-weight:700;font-size:14px;letter-spacing:.02em;cursor:pointer">' + btnLabel + '</button>' +
    '</div></div>';
}
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function jq(s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; }
function fmt(ms) { const d = new Date(Number(ms)); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

loadAll();
