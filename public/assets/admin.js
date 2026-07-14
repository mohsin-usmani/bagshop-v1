let ARTICLES = [];
let SETTINGS = {};
let CAT_IMAGES = {};
let CATEGORIES = [];
let NAV_CATS = []; // admin-chosen header categories, in order (max 10)
let WIZARD_AID = null;
let EDIT_MODAL_AID = null;
let EM_RELATED = []; // "You may also like" picks for the article being edited
let AUTH_FAIL_FIRED = false; // guard: only run authFail logic once

// Colour-name → swatch hex, for the variant chips in the wizard & edit modal.
const ADMIN_COLOR_CSS = {
  black:'#1C1C1C',brown:'#7B4B2A',red:'#CC2200',beige:'#D4B896',navy:'#1B2A6B',
  'navy blue':'#1B2A6B',cream:'#F0E6CC',green:'#2E7D32',pink:'#E91E63',white:'#EBEBEB',
  grey:'#757575',gray:'#757575',blue:'#1565C0','sky blue':'#5B9BD5','light blue':'#7EC8E3',
  'dark blue':'#0D1B4B',olive:'#6D7B2C',tan:'#C8965C',burgundy:'#7B1A2A',maroon:'#7B1A2A',
  gold:'#C9962E',purple:'#6A1B9A',silver:'#C0C0C0',teal:'#008080',coral:'#FF6B6B',
  orange:'#FF8C00',yellow:'#FFD700',mustard:'#D4A017',khaki:'#C3B091',
};
function colorHex(name) {
  if (!name) return '#ccc';
  return ADMIN_COLOR_CSS[String(name).trim().toLowerCase()] || '#ccc';
}

// Phone helpers — the admin enters a 10-digit mobile; we add the 91 country code
// automatically (wa.me and storage need it). Robust to numbers pasted with 91/0.
function normalizePhone(raw) {
  let d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (d.length === 11 && d[0] === "0") d = d.slice(1); // 0XXXXXXXXXX → XXXXXXXXXX
  if (d.length === 10) d = "91" + d;                    // add India country code
  return d;
}
// Full stored number → the 10-digit local part, for showing in the 10-digit input.
function phoneTo10(full) {
  const d = String(full == null ? "" : full).replace(/\D/g, "");
  if (d.length === 12 && d.slice(0, 2) === "91") return d.slice(2);
  if (d.length === 11 && d[0] === "0") return d.slice(1);
  return d;
}

// Any api() call that hits a CF Access redirect fires this event.
window.addEventListener("apiauthfail", e => authFail(e.detail));

// ---- tabs ----
document.getElementById("tabs").addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === "p-" + t.dataset.p));
  // Category Images lives on the Banners tab but is only ever (re)painted
  // right after an upload/selection change within the same session — switching
  // away and back (or just having left it loaded a while) showed stale state,
  // e.g. the Left/Right selector missing even once both photos existed.
  // Re-fetch + repaint every time this tab is opened so it's always current.
  if (t.dataset.p === "banners") loadBanners();
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
  loadLinks(); loadCustomerSuggestions(); loadOrders(); loadBanners(); loadCategories();
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
  if (!confirm("Remove the custom " + kind + "? The default will show instead.")) return;
  const { ok } = await api("/api/admin/branding?kind=" + kind, { method: "DELETE" });
  if (!ok) return toast("Failed");
  if (kind === "logo") SETTINGS.logo_url = ""; else SETTINGS.favicon_url = "";
  toast("Removed — default will show after refresh");
  renderBranding();
}

// ---- image cropper (fixed-ratio frame; drag + zoom the image inside it) ----
// openCropper(file, opts, onDone, onCancel)
//   opts: { ratio (w/h), title, ratioLabel, maxEdge, type, quality, name,
//           deviceCrops:[{name,ratio}] — optional; draws one colour-coded box
//           per device (+ a legend) showing exactly what each one will show.
//           perTargetAdjust:true — instead of one shared crop with preview
//           boxes, each deviceCrops entry (needs a `key`) gets its OWN
//           independently draggable/zoomable frame, switched via tabs; the
//           photo can be framed differently for each placement. }
//   onDone(File)                          — normal mode
//   onDone({ [key]: File, ... })          — perTargetAdjust mode
function openCropper(file, opts, onDone, onCancel) {
  const perTarget = !!(opts.perTargetAdjust && Array.isArray(opts.deviceCrops) && opts.deviceCrops.length);
  const ratio = opts.ratio || (perTarget ? opts.deviceCrops[0].ratio : 1);
  const maxEdge = opts.maxEdge || 1400;
  const type = opts.type || "image/jpeg";
  const quality = opts.quality != null ? opts.quality : 0.85;
  const objURL = URL.createObjectURL(file);
  const img = new Image();

  img.onerror = () => { URL.revokeObjectURL(objURL); toast("Could not read that image"); if (onCancel) onCancel(); };
  img.onload = () => {
    const natW = img.naturalWidth, natH = img.naturalHeight;
    const MAXW = Math.min(520, window.innerWidth - 60);
    // The legend/tabs row (when deviceCrops is set) adds real height above the
    // stage, so it needs a bigger chrome reservation than the plain cropper —
    // otherwise the stage claims space the footer's Cancel/Crop&use buttons
    // needed, and they get clipped below the dialog's max-height.
    const chromeReserve = (Array.isArray(opts.deviceCrops) && opts.deviceCrops.length) ? 320 : 250;
    const MAXH = Math.min(430, window.innerHeight - chromeReserve);
    const CROP_DEVICE_COLORS = ["#e0a03c", "#3fb0e0", "#e05a5a", "#7bd48d"];

    function fitFrame(r) {
      let fw = MAXW, fh = fw / r;
      if (fh > MAXH) { fh = MAXH; fw = fh * r; }
      return { fw: Math.round(fw), fh: Math.round(fh) };
    }
    function centeredState(r) {
      const { fw, fh } = fitFrame(r);
      const baseScale = Math.max(fw / natW, fh / natH);
      return { fw, fh, baseScale, scale: baseScale, ox: (fw - natW * baseScale) / 2, oy: (fh - natH * baseScale) / 2 };
    }
    // Rebuilds the exact pan/zoom that produced a previously-saved crop, from
    // its stored source rectangle (fractions of the original image) — used so
    // "Adjust" reopens showing what was actually chosen last time, not a
    // freshly re-centred crop that looks like nothing was framed yet.
    function stateFromRect(rect, r) {
      const { fw, fh } = fitFrame(r);
      const sx = rect.x * natW, sy = rect.y * natH, sw = rect.w * natW, sh = rect.h * natH;
      const scale = sw > 0 ? fw / sw : Math.max(fw / natW, fh / natH);
      return { fw, fh, baseScale: Math.max(fw / natW, fh / natH), scale, ox: -sx * scale, oy: -sy * scale };
    }

    const { fw, fh } = fitFrame(ratio);

    const modal = document.createElement("div");
    modal.className = "crop-modal";
    modal.innerHTML =
      '<div class="crop-dialog">' +
        '<div class="crop-head"><span class="crop-title">' + esc(opts.title || "Crop image") + '</span>' +
          '<button class="crop-x" aria-label="Close">✕</button></div>' +
        (opts.ratioLabel ? '<div class="crop-note">' + esc(opts.ratioLabel) + (perTarget ? ' — pick a tab below, then drag to reposition and use the slider to zoom just that one.' : ' — drag to reposition, use the slider to zoom.') + '</div>' : '') +
        (perTarget ? '<div class="crop-tabs" id="cropTabs"></div>'
          : (Array.isArray(opts.deviceCrops) && opts.deviceCrops.length ? '<div class="crop-legend" id="cropLegend"></div>' : '')) +
        '<div class="crop-stage" style="width:' + fw + 'px;height:' + fh + 'px">' +
          '<img alt=""><div class="crop-grid"></div>' +
        '</div>' +
        '<div class="crop-controls">' +
          '<span style="font-size:16px">−</span>' +
          '<input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1">' +
          '<span style="font-size:16px">+</span>' +
        '</div>' +
        '<div class="crop-foot">' +
          (perTarget ? '' : '<button class="btn ghost sm crop-original">Use original</button>') +
          '<div style="flex:1"></div>' +
          '<button class="btn ghost sm crop-cancel">Cancel</button>' +
          '<button class="btn crop-apply">' + (perTarget ? "Save all" : "Crop &amp; use") + '</button>' +
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

    function clamp(st) {
      const dw = natW * st.scale, dh = natH * st.scale;
      st.ox = Math.min(0, Math.max(st.fw - dw, st.ox));
      st.oy = Math.min(0, Math.max(st.fh - dh, st.oy));
    }
    function render(st) { imgEl.style.transform = "translate(" + st.ox + "px," + st.oy + "px) scale(" + st.scale + ")"; }
    function setZoom(st, z) {
      const ix = (st.fw / 2 - st.ox) / st.scale, iy = (st.fh / 2 - st.oy) / st.scale;
      st.scale = st.baseScale * z;
      st.ox = st.fw / 2 - ix * st.scale; st.oy = st.fh / 2 - iy * st.scale;
      clamp(st); render(st);
    }

    let active; // current live state object — { fw, fh, baseScale, scale, ox, oy }

    if (perTarget) {
      // Independent crop per placement: one state object per target key,
      // created lazily (centred/fit) the first time its tab is opened.
      const states = {};
      let activeKey = opts.deviceCrops[0].key;
      const tabsEl = document.getElementById("cropTabs");
      const tabBtns = {};
      opts.deviceCrops.forEach((dc, i) => {
        const color = CROP_DEVICE_COLORS[i % CROP_DEVICE_COLORS.length];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crop-tab";
        btn.innerHTML = '<span class="crop-legend-dot" style="background:' + color + '"></span>' + esc(dc.name);
        btn.onclick = () => selectTab(dc.key);
        tabsEl.appendChild(btn);
        tabBtns[dc.key] = btn;
      });
      function initialStateFor(dc) {
        const savedRect = opts.initialRects && opts.initialRects[dc.key];
        return savedRect ? stateFromRect(savedRect, dc.ratio) : centeredState(dc.ratio);
      }
      function selectTab(key) {
        activeKey = key;
        const dc = opts.deviceCrops.find((d) => d.key === key);
        if (!states[key]) states[key] = initialStateFor(dc);
        active = states[key];
        Object.keys(tabBtns).forEach((k) => tabBtns[k].classList.toggle("on", k === key));
        stage.style.width = active.fw + "px"; stage.style.height = active.fh + "px";
        zoom.value = active.scale / active.baseScale;
        clamp(active); render(active);
      }
      selectTab(activeKey);

      modal.querySelector(".crop-apply").onclick = () => {
        // Make sure every target has a state (tabs never opened default to centred/saved-rect).
        opts.deviceCrops.forEach((dc) => { if (!states[dc.key]) states[dc.key] = initialStateFor(dc); });
        const entries = opts.deviceCrops.map((dc) => {
          const st = states[dc.key];
          return exportRegion(-st.ox / st.scale, -st.oy / st.scale, st.fw / st.scale, st.fh / st.scale, dc.key);
        });
        // Also keep the unmodified original so "Adjust" can reopen the cropper
        // later without asking the admin to pick the file again.
        entries.push(exportRegion(0, 0, natW, natH, "original"));
        Promise.all(entries).then((files) => {
          const out = {};
          opts.deviceCrops.forEach((dc, i) => {
            const st = states[dc.key];
            const rect = { x: (-st.ox / st.scale) / natW, y: (-st.oy / st.scale) / natH, w: (st.fw / st.scale) / natW, h: (st.fh / st.scale) / natH };
            out[dc.key] = { file: files[i], rect };
          });
          out.original = { file: files[files.length - 1] };
          cleanup(); onDone(out);
        });
      };
    } else {
      active = { fw, fh, baseScale: Math.max(fw / natW, fh / natH), ox: 0, oy: 0, scale: 1 };
      active.scale = active.baseScale;
      active.ox = (fw - natW * active.scale) / 2; active.oy = (fh - natH * active.scale) / 2;

      // Responsive crop guides: the same photo is shown at different aspect
      // ratios per device (object-fit:cover), so each one keeps a different
      // region and cuts the rest. Draw one dashed box per device, colour-coded
      // and explained in the legend — so the admin can see exactly what each
      // device will show, not just the intersection of all of them.
      if (Array.isArray(opts.deviceCrops) && opts.deviceCrops.length) {
        const withInsets = opts.deviceCrops.map((dc) => {
          let insetX = 0, insetY = 0;
          if (dc.ratio > ratio)      insetY = (1 - ratio / dc.ratio) / 2; // wider device → top/bottom cut
          else if (dc.ratio < ratio) insetX = (1 - dc.ratio / ratio) / 2; // narrower device → sides cut
          return { ...dc, insetX, insetY, area: (1 - 2 * insetX) * (1 - 2 * insetY) };
        });
        withInsets.sort((a, b) => b.area - a.area); // largest box first, tightest last
        const legend = document.getElementById("cropLegend");
        withInsets.forEach((dc, i) => {
          const color = CROP_DEVICE_COLORS[i % CROP_DEVICE_COLORS.length];
          const box = document.createElement("div");
          box.className = "crop-device-box" + (i === withInsets.length - 1 ? " crop-tightest" : "");
          box.style.left = box.style.right = (dc.insetX * 100) + "%";
          box.style.top = box.style.bottom = (dc.insetY * 100) + "%";
          box.style.borderColor = color;
          stage.appendChild(box);
          if (legend) {
            const item = document.createElement("span");
            item.className = "crop-legend-item";
            item.innerHTML = '<span class="crop-legend-dot" style="background:' + color + '"></span>' + esc(dc.name);
            legend.appendChild(item);
          }
        });
      }

      modal.querySelector(".crop-apply").onclick = () =>
        exportRegion(-active.ox / active.scale, -active.oy / active.scale, active.fw / active.scale, active.fh / active.scale)
          .then((out) => { cleanup(); onDone(out); });
      modal.querySelector(".crop-original").onclick = () =>
        exportRegion(0, 0, natW, natH).then((out) => { cleanup(); onDone(out); });
    }

    clamp(active); render(active);

    let dragging = false, px = 0, py = 0;
    stage.addEventListener("pointerdown", (e) => { dragging = true; px = e.clientX; py = e.clientY; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener("pointermove", (e) => { if (!dragging) return; active.ox += e.clientX - px; active.oy += e.clientY - py; px = e.clientX; py = e.clientY; clamp(active); render(active); });
    const stop = (e) => { dragging = false; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} };
    stage.addEventListener("pointerup", stop);
    stage.addEventListener("pointercancel", stop);
    zoom.addEventListener("input", () => setZoom(active, parseFloat(zoom.value)));
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const z = Math.min(4, Math.max(1, parseFloat(zoom.value) + (e.deltaY < 0 ? 0.12 : -0.12))); zoom.value = z; setZoom(active, z); }, { passive: false });

    function cleanup() { URL.revokeObjectURL(objURL); modal.remove(); document.body.style.overflow = ""; }
    function exportRegion(sx, sy, sw, sh, name) {
      let ow = sw, oh = sh, m = Math.max(ow, oh);
      if (m > maxEdge) { const k = maxEdge / m; ow *= k; oh *= k; }
      ow = Math.max(1, Math.round(ow)); oh = Math.max(1, Math.round(oh));
      const c = document.createElement("canvas"); c.width = ow; c.height = oh;
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
      return new Promise((resolve) => {
        c.toBlob((blob) => {
          const ext = type === "image/png" ? ".png" : ".jpg";
          resolve(new File([blob], (opts.name || "image") + (name ? "-" + name : "") + ext, { type }));
        }, type, quality);
      });
    }

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
  rows.forEach(r => { CAT_IMAGES[r.category] = r; }); // full row: left/right urls + mobile_source/tile_source
  renderStock(); renderCatList();
  if (EDIT_MODAL_AID) refreshEditModal();
}

function allVariants() {
  const rows = [];
  ARTICLES.forEach((a) => (a.variants || []).forEach((v) => rows.push({ a, v })));
  return rows;
}

// Determines whether a product is visible to customers, mirroring the catalog API
// rule: at least one active variant (Live ticked) with qty > 0.
// Returns { live, reason } — reason explains what's missing when not live.
function stockLiveInfo(a) {
  const vs = a.variants || [];
  if (!vs.length) return { live: false, reason: "No colours/sizes yet — add one to go live." };
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

  // Filter to matching articles (search matches code / name / category).
  const filtered = articles.filter(a =>
    !rawQ ||
    (a.article_code || "").toLowerCase().includes(rawQ) ||
    (a.name || "").toLowerCase().includes(rawQ) ||
    (a.category || "").toLowerCase().includes(rawQ)
  );
  if (!filtered.length) {
    el.innerHTML = rawQ
      ? '<p class="muted">No results for that search.</p>'
      : '<p class="muted">No articles yet. Use <strong>Add Product</strong> to add one.</p>';
    return;
  }

  // Each article is ONE collapsible group: a header row (code, name, Live badge,
  // expand arrow) with its colour/size variant rows nested underneath. Groups are
  // collapsed by default (expanded automatically while searching) so the list stays
  // tidy instead of repeating the article name on every variant row.
  const chevron = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg>';
  const expandAll = !!rawQ;

  const groupsHTML = filtered.map(a => {
    const vs = a.variants || [];
    const info = stockLiveInfo(a);
    const collapsed = !expandAll;
    const badge = info.live ? '<span class="stock-badge live-badge">● Live</span>' : '<span class="stock-badge notlive-badge">Not live</span>';
    const reasonLine = (!info.live && info.reason) ? '<div class="notlive-reason">' + esc(info.reason) + '</div>' : '';
    const colours = new Set(vs.map(v => v.color).filter(Boolean)).size;
    const summary = vs.length
      ? (colours ? colours + ' colour' + (colours !== 1 ? 's' : '') + ' · ' : '') + vs.length + ' variant' + (vs.length !== 1 ? 's' : '')
      : 'No colours/sizes yet — tap Edit to add';
    const editBtn = '<button class="btn sm ghost sart-edit" onclick="event.stopPropagation();openEditModal(' + jq(a.id) + ')">✏ Edit</button>';
    const nameLine = (a.name || a.category)
      ? '<div class="sart-name">' + esc(a.name || '') + (a.name && a.category ? ' · ' : '') + esc(a.category || '') + '</div>'
      : '';

    const head =
      '<div class="sart-head' + (collapsed ? ' collapsed' : '') + '" data-aid="' + esc(a.id) + '" onclick="toggleArtGroup(this)">' +
        '<span class="sart-chev">' + (vs.length ? chevron : '') + '</span>' +
        '<div class="sart-info">' +
          '<div class="sart-title"><strong>' + esc(a.article_code) + '</strong>' + badge + '</div>' +
          nameLine +
          '<div class="sart-summary">' + esc(summary) + '</div>' +
          reasonLine +
        '</div>' +
        editBtn +
      '</div>';

    const vars = vs.map(v =>
      '<div class="svar' + (info.live ? '' : ' row-notlive-soft') + '" data-id="' + v.id + '" data-aid="' + esc(a.id) + '">' +
        '<div class="svar-name">' + esc(v.color || '—') + (v.size ? ' · ' + esc(v.size) : '') + '</div>' +
        '<div class="svar-fields">' +
          '<label class="svar-f"><span>Price</span><input class="pricebox price-in" type="number" value="' + (v.price != null ? v.price : "") + '" data-orig="' + (v.price != null ? v.price : "") + '" placeholder="' + (a.base_price ?? "") + '" oninput="stockRowDirty(this)"></label>' +
          '<label class="svar-f"><span>Qty</span><input class="qtybox qty-in" type="number" value="' + v.available_qty + '" data-orig="' + v.available_qty + '" oninput="stockRowDirty(this)"></label>' +
          '<label class="svar-f svar-live"><span>Live</span><input type="checkbox" class="act-in" ' + (v.is_active ? "checked" : "") + ' onchange="toggleStockLive(this)"></label>' +
          '<button class="row-save" style="display:none" onclick="saveRow(this)">Save</button>' +
        '</div>' +
      '</div>'
    ).join("");

    return '<div class="sart" data-aid="' + esc(a.id) + '">' + head +
      '<div class="sart-vars' + (collapsed ? ' collapsed' : '') + '">' + vars + '</div>' +
    '</div>';
  }).join("");

  el.innerHTML = '<div class="stock-list">' + groupsHTML + '</div>';
}

// Expand/collapse one article's variant card in the Stock list.
function toggleArtGroup(head) {
  const collapsed = head.classList.toggle("collapsed");
  const vars = head.parentElement.querySelector(".sart-vars");
  if (vars) vars.classList.toggle("collapsed", collapsed);
}

// Per-row editing: a Save button appears on a row only when its price or qty
// differs from what was loaded, and saves just that one variant on tap.
function stockRowDirty(inp) {
  const tr = inp.closest("[data-id]"); if (!tr) return;
  const pEl = tr.querySelector(".price-in"), qEl = tr.querySelector(".qty-in"), btn = tr.querySelector(".row-save");
  if (!btn) return;
  const changed = (pEl.value !== (pEl.dataset.orig || "")) || (qEl.value !== (qEl.dataset.orig || ""));
  btn.style.display = changed ? "inline-flex" : "none";
}
async function saveRow(btn) {
  const tr = btn.closest("[data-id]"); if (!tr) return;
  const id = tr.dataset.id, aid = tr.dataset.aid;
  const pEl = tr.querySelector(".price-in"), qEl = tr.querySelector(".qty-in"), aEl = tr.querySelector(".act-in");
  const price = pEl.value.trim() !== "" ? Number(pEl.value) : null;
  const qty = parseInt(qEl.value) || 0;
  btn.disabled = true;
  const { ok } = await api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates: [{ id, available_qty: qty, price, is_active: aEl.checked }] }) });
  btn.disabled = false;
  if (!ok) return toast("Save failed");
  // Update the local model + reset the dirty baseline so the button hides.
  for (const a of ARTICLES) { const v = (a.variants || []).find(x => x.id === id); if (v) { v.available_qty = qty; v.price = price; break; } }
  pEl.dataset.orig = pEl.value; qEl.dataset.orig = qEl.value;
  btn.style.display = "none";
  refreshArticleLive(aid); // qty 0 ↔ >0 can flip the Live badge
  toast("✓ Saved");
}

// The "Live" checkbox acts like a real switch: it saves that one colour immediately
// (along with its current qty/price shown in the row) and refreshes the Live badge,
// without touching other rows' unsaved edits or requiring "Save changes".
async function toggleStockLive(cb) {
  const tr = cb.closest("[data-id]");
  if (!tr) return;
  const vid = tr.dataset.id, aid = tr.dataset.aid;
  const qEl = tr.querySelector(".qty-in"), pEl = tr.querySelector(".price-in");
  const qty = qEl ? (parseInt(qEl.value) || 0) : 0;
  const price = pEl && pEl.value.trim() !== "" ? Number(pEl.value) : null;
  cb.disabled = true;
  const { ok } = await api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates: [{ id: vid, available_qty: qty, price, is_active: cb.checked }] }) });
  cb.disabled = false;
  if (!ok) { cb.checked = !cb.checked; return toast("Save failed"); }
  for (const a of ARTICLES) { const v = (a.variants || []).find(x => x.id === vid); if (v) { v.is_active = cb.checked ? 1 : 0; v.available_qty = qty; v.price = price; break; } }
  refreshArticleLive(aid);
  const info = stockLiveInfo(ARTICLES.find(a => a.id === aid) || {});
  toast(cb.checked ? (info.live ? "✓ Colour is live" : "Saved — add stock qty to go live") : "Colour hidden");
}

// Recompute an article's Live/Not-live state and update just its rows in the table
// (badge, reason, and dimmed styling) — no full re-render, so edits elsewhere stay.
function refreshArticleLive(aid) {
  const a = ARTICLES.find(x => x.id === aid);
  if (!a) return;
  const info = stockLiveInfo(a);
  // Variant cards get the dimmed style; the header carries the badge/reason.
  document.querySelectorAll("#stockTable .svar").forEach(row => {
    if (row.dataset.aid === String(aid)) row.classList.toggle("row-notlive-soft", !info.live);
  });
  const head = [...document.querySelectorAll("#stockTable .sart-head")].find(h => h.dataset.aid === String(aid));
  if (!head) return;
  const badge = head.querySelector(".stock-badge");
  if (badge) { badge.className = "stock-badge " + (info.live ? "live-badge" : "notlive-badge"); badge.textContent = info.live ? "● Live" : "Not live"; }
  const host = head.querySelector(".sart-info") || head;
  let reason = host.querySelector(".notlive-reason");
  if (!info.live && info.reason) {
    if (!reason) { reason = document.createElement("div"); reason.className = "notlive-reason"; host.appendChild(reason); }
    reason.textContent = info.reason;
  } else if (reason) { reason.remove(); }
}

function renderCatList() {
  const cats = [...new Set(ARTICLES.map((a) => a.category).filter(Boolean))];
  document.getElementById("catList").innerHTML = cats.map((c) => '<option value="' + esc(c) + '">').join("");
}

// Banner link search — same rich autocomplete as "You may also like" (thumbnail
// + name), so the admin can spot the right product/category at a glance
// instead of a plain text dropdown. Shared by the "add banner" form and every
// existing banner's link field (each has its own input id + matching
// "<id>_results" box).
function bannerLinkSearch(inputId) {
  const inp = document.getElementById(inputId);
  const box = document.getElementById(inputId + "_results");
  if (!inp || !box) return;
  const q = (inp.value || "").trim().toLowerCase();
  if (!q) { box.innerHTML = ""; box.style.display = "none"; return; }
  const cats = [...new Set(ARTICLES.map(a => a.category).filter(Boolean))]
    .filter(c => c.toLowerCase().includes(q)).slice(0, 5);
  const prods = ARTICLES.filter(a =>
    (a.name || "").toLowerCase().includes(q) || (a.article_code || "").toLowerCase().includes(q)
  ).slice(0, 6);
  const catHtml = cats.map(c =>
    '<div class="rel-result" onclick="pickBannerLink(' + jq(inputId) + ',' + jq(c) + ')">' +
      '<span class="rel-thumb rel-thumb-empty"></span>' +
      '<div class="rel-result-txt"><div class="rel-result-name">' + esc(c) + '</div>' +
      '<div class="rel-result-sub">Category</div></div>' +
    '</div>'
  ).join("");
  const prodHtml = prods.map(a => {
    const url = (a.photos && a.photos[0]) ? a.photos[0].url : "";
    const thumb = url ? '<img class="rel-thumb" src="' + esc(url) + '" alt="" loading="lazy">' : '<span class="rel-thumb rel-thumb-empty"></span>';
    return '<div class="rel-result" onclick="pickBannerLink(' + jq(inputId) + ',' + jq(a.article_code) + ')">' +
      thumb +
      '<div class="rel-result-txt"><div class="rel-result-name">' + esc(a.name || a.article_code) + '</div>' +
      '<div class="rel-result-sub">' + esc(a.article_code) + (a.category ? ' · ' + esc(a.category) : '') + '</div></div>' +
    '</div>';
  }).join("");
  box.innerHTML = (catHtml + prodHtml) || '<div class="rel-empty">No matches</div>';
  box.style.display = "block";
}
function pickBannerLink(inputId, value) {
  const inp = document.getElementById(inputId);
  if (inp) inp.value = value;
  const box = document.getElementById(inputId + "_results");
  if (box) { box.innerHTML = ""; box.style.display = "none"; }
  if (inputId.indexOf("bl_") === 0) bannerRowDirty(inputId.slice(3));
}
// Closes the dropdown on blur (e.g. when the admin pastes a URL — there's
// never a product/category match for that, so "No matches" would otherwise
// stay open forever and sit on top of the Visible/Delete row below it).
// Called via a short setTimeout from onblur so a click on a result still
// registers before the box disappears.
function closeBannerResults(inputId) {
  const box = document.getElementById(inputId + "_results");
  if (box) box.style.display = "none";
}

// Category picker: a text input (type a new or existing category) plus a native
// <select> arrow. The datalist arrow only shows on desktop Chrome, so mobile had
// no way to browse existing categories — the overlaid <select> opens the OS
// picker on mobile AND a dropdown on desktop, while free-typing still works.
function catComboHTML(inputId, value) {
  const cats = [...new Set(ARTICLES.map((a) => a.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opts = cats.map((c) => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join("");
  return '<div class="cat-combo">' +
      '<input id="' + inputId + '" placeholder="Handbag" list="catList" autocomplete="off" value="' + esc(value || "") + '">' +
      '<select class="cat-combo-select" aria-label="Choose an existing category" ' +
        'onchange="if(this.value){document.getElementById(\'' + inputId + '\').value=this.value;}this.selectedIndex=0">' +
        '<option value="">Choose existing…</option>' + opts +
      '</select>' +
      '<span class="cat-combo-arrow" aria-hidden="true">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</span>' +
    '</div>';
}

// renderArticles kept as no-op (list is now in stock; edit via modal)
function renderArticles() {}

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
  // If we already created the article (e.g. user came Back from step 2), prefill it and edit in place.
  const a = WIZARD_AID ? (ARTICLES.find(x => x.id === WIZARD_AID) || {}) : {};
  const editing = !!WIZARD_AID;
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step on">1</span><span class="wz-step' + (editing ? ' done' : '') + '">2</span><span class="wz-step' + (editing ? ' done' : '') + '">3</span><span class="wz-step' + (editing ? ' done' : '') + '">4</span></div>' +
        '<h4 style="margin:0;flex:1">Basic Info</h4>' +
        '<button class="btn sm ghost" onclick="hideWizard()">Cancel</button>' +
      '</div>' +
      '<div class="grid2">' +
        '<div class="field"><label>Article Code *</label><input id="wz1_code" placeholder="BAG-1023" autocomplete="off" value="' + esc(a.article_code || "") + '"></div>' +
        '<div class="field"><label>Name</label><input id="wz1_name" placeholder="Ladies Handbag" value="' + esc(a.name || "") + '"></div>' +
        '<div class="field"><label>Category *</label>' + catComboHTML("wz1_cat", a.category) + '</div>' +
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

  if (WIZARD_AID) {
    // Editing the already-created article (came Back from a later step) — update in place.
    // Price is set per-colour in step 2, not here, so keep whatever base_price already exists.
    const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
    const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: WIZARD_AID, article_code: code, name, category: cat, description: desc,
        base_price: a.base_price ?? null, is_active: 1, is_new_arrival: a.is_new_arrival ? 1 : 0 }) });
    if (!ok) return toast("Failed to save changes");
    toast("Details saved");
    await loadArticles();
    renderWizardStep2();
    return;
  }

  const { ok, data } = await api("/api/admin/articles", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ article_code: code, name, category: cat, description: desc, base_price: null }) });
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
        '<div class="wz-steps"><span class="wz-step done">✓</span><span class="wz-step on">2</span><span class="wz-step">3</span><span class="wz-step">4</span></div>' +
        '<h4 style="margin:0;flex:1">Colours &amp; Stock — <strong>' + esc(a.article_code || "") + '</strong></h4>' +
        '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;cursor:pointer;font-weight:normal">' +
          '<input type="checkbox" id="wz2_na" ' + (a.is_new_arrival ? "checked" : "") + ' onchange="wzToggleNewArrival()" style="width:auto"> ⚡ New Arrival' +
        '</label>' +
      '</div>' +
      '<div id="wzVariantList" style="margin-bottom:14px"></div>' +
      '<div class="vadd">' +
        '<button type="button" class="vadd-btn" id="wzAddBtn" onclick="wzShowAddForm()">+ Add colour / size</button>' +
        '<div class="vadd-form" id="wzAddForm">' +
          '<div class="vadd-fields">' +
            '<div class="vadd-f"><label>Colour</label><input id="wz2_vc" list="wzColors" autocomplete="off"><datalist id="wzColors">' + colorOpts + '</datalist></div>' +
            '<div class="vadd-f"><label>Size</label><input id="wz2_vs"></div>' +
            '<div class="vadd-f"><label>Price</label><input id="wz2_vp" type="number" placeholder="' + (a.base_price != null ? a.base_price : "Price") + '"></div>' +
            '<div class="vadd-f vadd-f-qty"><label>Qty</label><input id="wz2_vq" type="number" value="1"></div>' +
          '</div>' +
          '<div class="vadd-actions">' +
            '<button type="button" class="btn ghost sm" id="wzAddCancel" onclick="wzHideAddForm()">Cancel</button>' +
            '<button type="button" class="btn sm" onclick="wzAddVariant()">+ Add</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="row-actions" style="justify-content:space-between;margin-top:16px;gap:8px;flex-wrap:wrap">' +
        '<button class="btn ghost sm" onclick="renderWizardStep1()">← Back</button>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn ghost sm" onclick="wzStep3()">Skip</button>' +
          '<button class="btn" onclick="wzStep3()">Next: You May Also Like →</button>' +
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
  if (!vs.length) {
    el.innerHTML = '<p class="muted" style="font-size:13px">No colours/sizes added yet — add the first one below.</p>';
    wzSyncAddArea(false);
    return;
  }
  el.innerHTML = '<div class="vchips">' + vs.map(v => {
    const price = v.price != null ? v.price : (a.base_price ?? '?');
    return '<div class="vchip">' +
      '<span class="vchip-sw" style="background:' + colorHex(v.color) + '"></span>' +
      '<span class="vchip-color">' + esc(v.color || "—") + '</span>' +
      (v.size ? '<span class="vchip-size">' + esc(v.size) + '</span>' : '') +
      '<span class="vchip-price">' + esc(cur) + ' ' + price + '</span>' +
      '<span class="vchip-qty">Qty ' + v.available_qty + '</span>' +
      '<button class="vchip-x" title="Remove" onclick="wzDelVariant(' + jq(v.id) + ')">✕</button>' +
    '</div>';
  }).join("") + '</div>';
  wzSyncAddArea(true);
}
// Show fields inline for the first variant; collapse to an "Add" button afterwards.
function wzSyncAddArea(hasVariants) {
  const btn = document.getElementById("wzAddBtn"), form = document.getElementById("wzAddForm"), cancel = document.getElementById("wzAddCancel");
  if (!btn || !form) return;
  if (hasVariants) { btn.style.display = "inline-flex"; form.style.display = "none"; if (cancel) cancel.style.display = "inline-flex"; }
  else { btn.style.display = "none"; form.style.display = "flex"; if (cancel) cancel.style.display = "none"; }
}
function wzShowAddForm() {
  const btn = document.getElementById("wzAddBtn"), form = document.getElementById("wzAddForm"), cancel = document.getElementById("wzAddCancel");
  if (btn) btn.style.display = "none";
  if (form) form.style.display = "flex";
  if (cancel) cancel.style.display = "inline-flex";
  const vc = document.getElementById("wz2_vc"); if (vc) vc.focus();
}
function wzHideAddForm() {
  ["wz2_vc","wz2_vs","wz2_vp"].forEach(id => { const e = document.getElementById(id); if (e) e.value = ""; });
  const q = document.getElementById("wz2_vq"); if (q) q.value = "1";
  wzSyncAddArea(true);
}
async function wzAddVariant() {
  if (!WIZARD_AID) return;
  const color = val("wz2_vc"), size = val("wz2_vs"), price = val("wz2_vp"), qty = val("wz2_vq") || 0;
  const isActive = 0; // new products start NOT live — publish via the Live toggle (here or in Stock)
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
  if (!confirm("Remove this colour/size?")) return;
  const { ok } = await api("/api/admin/variants?id=" + encodeURIComponent(vid), { method: "DELETE" });
  if (!ok) return toast("Failed");
  await loadArticles(); renderWizardVariantList();
}
async function wzToggleNewArrival() {
  if (!WIZARD_AID) return;
  const a = ARTICLES.find(x => x.id === WIZARD_AID); if (!a) return;
  const checked = (document.getElementById("wz2_na") || {}).checked;
  const { ok } = await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: WIZARD_AID, article_code: a.article_code, name: a.name, category: a.category,
      base_price: a.base_price, description: a.description, is_active: 1, is_new_arrival: checked ? 1 : 0 }) });
  // Keep the in-memory copy in sync — later steps (e.g. saving "You may also
  // like") re-send every field from this same object, and would otherwise
  // silently revert this back to its old value using stale data.
  if (ok) a.is_new_arrival = checked ? 1 : 0;
}
// Live-status bar shown inside the wizard (steps 2 & 3). The Live toggle is the same
// switch as the per-colour "Live" box in Stock — it turns every colour of this product
// on/off. New products start NOT live, so the admin flips this when ready to publish.
function wzStatusHTML() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID);
  if (!a) return '';
  const info = stockLiveInfo(a);
  const vs = a.variants || [];
  const anyLive = vs.some(v => v.is_active);
  const hasPhoto = (a.photos || []).length > 0;
  // Photos step only: without a photo yet, the toggle is dulled and won't
  // actually turn the product live — tapping it explains why instead.
  const msg = !hasPhoto ? 'Add a photo to go live.' : (info.live ? 'This product is visible to customers.' : esc(info.reason));
  const toggle = vs.length
    ? '<label class="wz-live-toggle' + (hasPhoto ? '' : ' dulled') + '" title="' + (hasPhoto ? 'Show/hide this product to customers — same as the Live switch in Stock' : 'Add a photo first to go live') + '">' +
        '<input type="checkbox" ' + (anyLive ? 'checked' : '') + ' onchange="wzSetLive(this.checked)"> Live' +
      '</label>'
    : '';
  return '<div class="wz-status ' + (info.live ? 'on' : 'off') + '">' +
    '<div class="wz-status-main">' +
      '<span class="' + (info.live ? 'live-badge' : 'notlive-badge') + '">' + (info.live ? '● Live' : 'Not live') + '</span>' +
      '<span class="wz-status-msg">' + msg + '</span>' +
    '</div>' +
    toggle +
  '</div>';
}
function refreshWizardStatus() {
  const el = document.getElementById("wzStatus");
  if (el) el.innerHTML = wzStatusHTML();
}
// Master Live switch for the wizard — sets every colour of the product on/off at once.
async function wzSetLive(checked) {
  const a = ARTICLES.find(x => x.id === WIZARD_AID); if (!a) return;
  const vs = a.variants || [];
  if (!vs.length) return;
  if (checked && !(a.photos || []).length) {
    toast("Add a photo to go live");
    refreshWizardStatus(); // snap the checkbox back — nothing actually changed
    return;
  }
  const updates = vs.map(v => ({ id: v.id, available_qty: v.available_qty, price: v.price, is_active: checked }));
  const { ok } = await api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates }) });
  if (!ok) return toast("Failed");
  vs.forEach(v => { v.is_active = checked ? 1 : 0; });
  refreshWizardStatus();
  const info = stockLiveInfo(a);
  toast(checked ? (info.live ? "✓ Product is live" : "Live on — add stock qty to show it") : "Product hidden");
}

// Step 3 — "You may also like": pick a few products to recommend on this
// product's page, same picker used in the Edit modal (relatedEditorHTML /
// relSearch / addRelated / removeRelated), just reused here against the
// article the wizard already created in step 1.
function wzStep3() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
  try { const r = JSON.parse(a.related_ids || "[]"); EM_RELATED = Array.isArray(r) ? r.filter(Boolean) : []; }
  catch (e) { EM_RELATED = []; }
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step done">✓</span><span class="wz-step done">✓</span><span class="wz-step on">3</span><span class="wz-step">4</span></div>' +
        '<h4 style="margin:0;flex:1">You May Also Like — <strong>' + esc(a.article_code || "") + '</strong></h4>' +
        '<span class="muted" style="font-size:13px">Optional</span>' +
      '</div>' +
      '<p class="muted" style="margin-bottom:12px;font-size:13px">Pick a few products to recommend on this product\'s page.</p>' +
      '<div id="ev-rel-' + a.id + '">' + relatedEditorHTML(a) + '</div>' +
      '<div class="row-actions" style="justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:8px">' +
        '<button class="btn ghost sm" onclick="renderWizardStep2()">← Back</button>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn ghost sm" onclick="wzStep3Next()">Skip</button>' +
          '<button class="btn" onclick="wzStep3Next()">Next: Photos →</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}
// Persists whatever "You may also like" picks were made (Skip and Next behave
// the same — this step is optional either way, so there's nothing to discard)
// then moves on to the photos step.
async function wzStep3Next() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID);
  if (a) {
    await api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: WIZARD_AID, article_code: a.article_code, name: a.name, category: a.category,
        base_price: a.base_price, description: a.description, is_active: 1, is_new_arrival: a.is_new_arrival ? 1 : 0,
        related_ids: EM_RELATED }) });
    a.related_ids = JSON.stringify(EM_RELATED);
  }
  wzStep4();
}
function wzStep4() {
  const a = ARTICLES.find(x => x.id === WIZARD_AID) || {};
  const knownColors = [...new Set((a.variants || []).map(v => v.color).filter(Boolean))];
  const colorOpts = knownColors.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  document.getElementById("wzContainer").innerHTML =
    '<div class="card artcard">' +
      '<div class="wz-header">' +
        '<div class="wz-steps"><span class="wz-step done">✓</span><span class="wz-step done">✓</span><span class="wz-step done">✓</span><span class="wz-step on">4</span></div>' +
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
        '<button class="btn ghost sm" onclick="wzStep3()">← Back</button>' +
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
  if (!confirm("Delete this photo?")) return;
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
  const a = ARTICLES.find(x => x.id === aid);
  try { const r = JSON.parse((a && a.related_ids) || "[]"); EM_RELATED = Array.isArray(r) ? r.filter(Boolean) : []; }
  catch (e) { EM_RELATED = []; }
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
  const info = stockLiveInfo(a);
  const statusPill = info.live ? '<span class="live-badge">● Live</span>' : '<span class="notlive-badge">Not live</span>';

  const hasV = a.variants.length > 0;
  const vs = a.variants.map(v =>
    '<div class="ev-row">' +
      '<span class="ev-sw" style="background:' + colorHex(v.color) + '"></span>' +
      '<div class="ev-vlabel"><strong>' + esc(v.color || '—') + '</strong>' + (v.size ? '<span class="ev-size">' + esc(v.size) + '</span>' : '') + '</div>' +
      '<label class="ev-mini">Qty<input type="number" id="vq2_' + v.id + '" value="' + v.available_qty + '"></label>' +
      '<label class="ev-mini">Price<input type="number" id="vp2_' + v.id + '" value="' + (v.price != null ? v.price : '') + '" placeholder="' + (a.base_price ?? '') + '"></label>' +
      '<button class="ev-del" title="Remove this colour / size" onclick="delVariant(' + jq(v.id) + ')">✕</button>' +
    '</div>'
  ).join('') || '<p class="muted" style="font-size:13px">No colours or sizes yet — add the first one below.</p>';

  const photos = (a.photos || []).map(p =>
    '<div class="t"><img src="' + esc(p.url) + '">' +
      (p.color ? '<div style="font-size:10px;text-align:center;color:var(--muted)">' + esc(p.color) + '</div>' : '') +
      '<span class="rm" onclick="delPhoto(' + jq(p.id) + ')">✕</span>' +
    '</div>'
  ).join('') || '<p class="muted" style="font-size:12px;margin:0">No photos yet.</p>';

  return (
    '<div class="ev-status">' + statusPill +
      '<span class="muted" style="font-size:12.5px">' + (info.live ? 'Visible to customers.' : esc(info.reason || 'Not visible yet.')) + '</span></div>' +

    // ── Details ──
    '<section class="ev-card">' +
      '<div class="ev-card-title">Details</div>' +
      '<div class="grid2">' +
        '<div class="field"><label>Article Code</label><input id="ec_' + a.id + '" value="' + esc(a.article_code) + '"></div>' +
        '<div class="field"><label>Name</label><input id="en_' + a.id + '" value="' + esc(a.name || "") + '"></div>' +
        '<div class="field"><label>Category</label>' + catComboHTML("ect_" + a.id, a.category) + '</div>' +
        '<div class="field"><label>Base Price (' + esc(cur) + ')</label><input id="ebp_' + a.id + '" type="number" value="' + (a.base_price ?? "") + '"></div>' +
      '</div>' +
      '<div class="field"><label>Description</label><textarea id="edd_' + a.id + '" rows="2" style="resize:vertical">' + esc(a.description || "") + '</textarea></div>' +
      '<label class="ev-check"><input type="checkbox" id="ena_' + a.id + '" ' + (a.is_new_arrival ? "checked" : "") + '> ⚡ Mark as New Arrival</label>' +
    '</section>' +

    // ── Colours & sizes ──
    '<section class="ev-card">' +
      '<div class="ev-card-title">Colours &amp; sizes <span class="ev-card-note">edit qty / price, then Save changes below</span></div>' +
      '<div class="ev-list">' + vs + '</div>' +
      '<div class="vadd">' +
        '<button type="button" class="vadd-btn" id="emAddBtn_' + a.id + '" style="display:' + (hasV ? 'inline-flex' : 'none') + '" onclick="emShowAddForm(' + jq(a.id) + ')">+ Add colour / size</button>' +
        '<div class="vadd-form" id="emAddForm_' + a.id + '" style="display:' + (hasV ? 'none' : 'flex') + '">' +
          '<div class="vadd-fields">' +
            '<div class="vadd-f"><label>Colour</label><input id="vc_' + a.id + '" list="artColors_' + a.id + '"><datalist id="artColors_' + a.id + '">' + colorOpts + '</datalist></div>' +
            '<div class="vadd-f"><label>Size</label><input id="vs_' + a.id + '"></div>' +
            '<div class="vadd-f"><label>Price</label><input id="vp_' + a.id + '" type="number" placeholder="' + (a.base_price != null ? a.base_price : "Price") + '"></div>' +
            '<div class="vadd-f vadd-f-qty"><label>Qty</label><input id="vq_' + a.id + '" type="number" value="1"></div>' +
          '</div>' +
          '<div class="vadd-actions">' +
            '<button type="button" class="btn ghost sm" id="emAddCancel_' + a.id + '" style="display:' + (hasV ? 'inline-flex' : 'none') + '" onclick="emHideAddForm(' + jq(a.id) + ')">Cancel</button>' +
            '<button type="button" class="btn sm" onclick="addVariant(' + jq(a.id) + ')">+ Add</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    // ── You may also like (curated recommendations) ──
    '<section class="ev-card">' +
      '<div class="ev-card-title">You may also like <span class="ev-card-note">shown on this product\'s page — pick a few to recommend</span></div>' +
      '<div id="ev-rel-' + a.id + '">' + relatedEditorHTML(a) + '</div>' +
    '</section>' +

    // ── Photos (auto-saved) ──
    '<section class="ev-card">' +
      '<div class="ev-card-title">Photos <span class="ev-card-note">added &amp; removed instantly</span></div>' +
      '<div class="thumbs">' + photos + '</div>' +
      '<div class="ev-add" style="margin-top:12px">' +
        '<div class="ev-add-f"><label>Photo colour</label><select id="pc_' + a.id + '"><option value="">— any —</option>' + colorOpts + '</select></div>' +
        '<div class="ev-add-f" style="flex:1.4"><label>Add photos</label><input type="file" accept="image/*" multiple onchange="uploadPhoto(' + jq(a.id) + ',this)"></div>' +
      '</div>' +
      '<p class="muted" style="font-size:12px;margin-top:8px">Tag each photo with its colour so customers see the right image when they switch colour.</p>' +
    '</section>'
  );
}

// Single save for the edit modal: writes the Details fields AND every colour's
// qty/price in one action (photos are already saved on upload/delete). This is the
// only "save" the admin needs — no more per-section buttons.
async function saveEditModal(aid) {
  aid = aid || EDIT_MODAL_AID;
  if (!aid) return;
  const body = {
    id: aid,
    article_code: val("ec_" + aid),
    name: val("en_" + aid),
    category: val("ect_" + aid),
    base_price: val("ebp_" + aid) ? Number(val("ebp_" + aid)) : null,
    description: (document.getElementById("edd_" + aid) || {}).value?.trim() || "",
    is_active: 1, // visibility is driven by the per-colour Live toggle, not here
    is_new_arrival: !!(document.getElementById("ena_" + aid) || {}).checked,
    related_ids: EM_RELATED,
  };
  if (!body.article_code || !body.category) return toast("Article code and category are required");
  const a = ARTICLES.find(x => x.id === aid) || {};
  const updates = (a.variants || []).map(v => {
    const qEl = document.getElementById("vq2_" + v.id), pEl = document.getElementById("vp2_" + v.id);
    return {
      id: v.id,
      available_qty: qEl ? (parseInt(qEl.value) || 0) : v.available_qty,
      price: pEl && pEl.value.trim() !== "" ? Number(pEl.value) : null,
      is_active: v.is_active ? 1 : 0,
    };
  });
  const [artRes, varRes] = await Promise.all([
    api("/api/admin/articles", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    updates.length
      ? api("/api/admin/variants", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates }) })
      : Promise.resolve({ ok: true }),
  ]);
  if (artRes.ok && varRes.ok) { toast("✓ Saved"); await loadArticles(); }
  else toast("Save failed");
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
  if (ok) { toast("Added"); loadArticles(); } // refreshEditModal() collapses the form back to the button
}
// Inline-expand add form inside the (already-modal) edit screen — avoids a nested popup.
function emShowAddForm(aid) {
  const btn = document.getElementById("emAddBtn_" + aid), form = document.getElementById("emAddForm_" + aid), cancel = document.getElementById("emAddCancel_" + aid);
  if (btn) btn.style.display = "none";
  if (form) form.style.display = "flex";
  if (cancel) cancel.style.display = "inline-flex";
  const vc = document.getElementById("vc_" + aid); if (vc) vc.focus();
}
function emHideAddForm(aid) {
  ["vc_","vs_","vp_"].forEach(p => { const e = document.getElementById(p + aid); if (e) e.value = ""; });
  const q = document.getElementById("vq_" + aid); if (q) q.value = "1";
  const btn = document.getElementById("emAddBtn_" + aid), form = document.getElementById("emAddForm_" + aid);
  if (btn) btn.style.display = "inline-flex";
  if (form) form.style.display = "none";
}

// "You may also like" editor — reads/writes the module-level EM_RELATED list,
// saved with the rest of the article on "Save changes".
function relThumbHTML(x) {
  const url = (x.photos && x.photos[0]) ? x.photos[0].url : "";
  return url
    ? '<img class="rel-thumb" src="' + esc(url) + '" alt="" loading="lazy">'
    : '<span class="rel-thumb rel-thumb-empty"></span>';
}
function relatedEditorHTML(a) {
  const chosen = EM_RELATED.map(id => ARTICLES.find(x => x.id === id)).filter(Boolean);
  const chips = chosen.length
    ? '<div class="rel-chips">' + chosen.map(r =>
        '<span class="rel-chip">' + relThumbHTML(r) + '<span class="rel-chip-name">' + esc(r.name || r.article_code) + '</span>' +
        '<button type="button" title="Remove" onclick="removeRelated(' + jq(a.id) + ',' + jq(r.id) + ')">✕</button></span>'
      ).join('') + '</div>'
    : '<p class="muted" style="font-size:12.5px;margin:0 0 10px">None yet — search below to add.</p>';
  return chips +
    '<div class="rel-search-wrap">' +
      '<input id="rel-search-' + a.id + '" class="rel-search" autocomplete="off" placeholder="Search products to recommend…" oninput="relSearch(' + jq(a.id) + ')">' +
      '<div class="rel-results" id="rel-results-' + a.id + '" style="display:none"></div>' +
    '</div>';
}
// Live search over all products, shown with a tiny thumbnail so the admin can spot
// the right one at a glance instead of scrolling a long dropdown.
function relSearch(aid) {
  const inp = document.getElementById("rel-search-" + aid);
  const box = document.getElementById("rel-results-" + aid);
  if (!inp || !box) return;
  const q = (inp.value || "").trim().toLowerCase();
  if (!q) { box.innerHTML = ""; box.style.display = "none"; return; }
  const matches = ARTICLES.filter(x =>
    x.id !== aid && !EM_RELATED.includes(x.id) &&
    ((x.name || "").toLowerCase().includes(q) || (x.article_code || "").toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q))
  ).slice(0, 8);
  box.innerHTML = matches.length
    ? matches.map(x =>
        '<div class="rel-result" onclick="addRelated(' + jq(aid) + ', ' + jq(x.id) + ')">' +
          relThumbHTML(x) +
          '<div class="rel-result-txt"><div class="rel-result-name">' + esc(x.name || x.article_code) + '</div>' +
          '<div class="rel-result-sub">' + esc(x.article_code) + (x.category ? ' · ' + esc(x.category) : '') + '</div></div>' +
        '</div>'
      ).join("")
    : '<div class="rel-empty">No matches</div>';
  box.style.display = "block";
}
function renderRelatedEditor(aid) {
  const host = document.getElementById("ev-rel-" + aid);
  const a = ARTICLES.find(x => x.id === aid);
  if (host && a) host.innerHTML = relatedEditorHTML(a);
}
function addRelated(aid, rid) {
  if (rid && !EM_RELATED.includes(rid)) EM_RELATED.push(rid);
  renderRelatedEditor(aid); // rebuild — clears the search box + results
}
function removeRelated(aid, rid) {
  EM_RELATED = EM_RELATED.filter(x => x !== rid);
  renderRelatedEditor(aid);
}
async function delVariant(id) {
  if (!confirm("Remove this colour/size?")) return;
  const { ok } = await api("/api/admin/variants?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Removed"); loadArticles(); }
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
  if (!confirm("Delete this photo?")) return;
  const { ok } = await api("/api/admin/photos?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Photo removed"); loadArticles(); }
}

// ---- links ----
async function createLink() {
  const phone = normalizePhone(lk_phone.value); // 10-digit input → 91XXXXXXXXXX
  const body = { label: lk_label.value.trim(), phone, hours: lk_hours.value };
  const { ok, data } = await api("/api/admin/tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!ok || !data.link) return toast("Failed");
  const wa = phone ? "https://wa.me/" + phone + "?text=" +
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
  loadCustomerSuggestions(); // remember this customer for next time
}
function copyLink() { navigator.clipboard.writeText(document.getElementById("theLink").textContent).then(() => toast("Copied")); }

// ---- create-link autocomplete (remembers past customers) ----
let CUSTOMERS = [];   // [{label, phone}] of everyone we've dealt with before
let AC_MATCHES = [];  // currently shown suggestions (shared; one dropdown open at a time)

async function loadCustomerSuggestions() {
  const { data } = await api("/api/admin/tokens?suggest=1");
  if (data && data.customers) CUSTOMERS = data.customers;
}

function acFilter(field) {
  const isPhone = field === "phone";
  const inp = document.getElementById(isPhone ? "lk_phone" : "lk_label");
  const drop = document.getElementById(isPhone ? "lk_phone_ac" : "lk_label_ac");
  const other = document.getElementById(isPhone ? "lk_label_ac" : "lk_phone_ac");
  if (other) other.style.display = "none";
  const q = (inp.value || "").trim().toLowerCase();
  const qd = q.replace(/[^0-9]/g, "");
  if (!q) { drop.style.display = "none"; return; }
  AC_MATCHES = CUSTOMERS.filter((c) => {
    const phone = c.phone || "", label = (c.label || "").toLowerCase();
    return isPhone ? (qd && phone.includes(qd)) : (label.includes(q) || (qd && phone.includes(qd)));
  }).slice(0, 8);
  if (!AC_MATCHES.length) { drop.style.display = "none"; return; }
  drop.innerHTML = AC_MATCHES.map((c, i) =>
    '<div class="ac-item" onclick="acPick(' + i + ')"><strong>' + esc(c.label || "—") + '</strong><span>' + esc(c.phone || "") + '</span></div>'
  ).join("");
  drop.style.display = "block";
}

function acPick(i) {
  const c = AC_MATCHES[i];
  if (!c) return;
  document.getElementById("lk_label").value = c.label || "";
  document.getElementById("lk_phone").value = phoneTo10(c.phone || "");
  document.getElementById("lk_label_ac").style.display = "none";
  document.getElementById("lk_phone_ac").style.display = "none";
}

// Close the suggestion dropdowns when clicking away.
document.addEventListener("click", (e) => {
  if (!e.target.closest("#lk_label, #lk_label_ac")) {
    const d = document.getElementById("lk_label_ac"); if (d) d.style.display = "none";
  }
  if (!e.target.closest("#lk_phone, #lk_phone_ac")) {
    const d = document.getElementById("lk_phone_ac"); if (d) d.style.display = "none";
  }
});

async function loadLinks() {
  const { data } = await api("/api/admin/tokens");
  if (!data || data.error) return;
  const now = data.now;
  const el = document.getElementById("linkList");
  if (!data.tokens.length) { el.innerHTML = '<p class="muted">No links yet.</p>'; return; }
  el.innerHTML = '<div class="arow-list">' +
    data.tokens.map((t) => {
      const expired = t.is_revoked || now > t.expires_at;
      const status = t.is_revoked ? '<span class="expired">Revoked</span>' : (expired ? '<span class="expired">Expired</span>' : '<span class="live">Active</span>');
      const adjust = expired ? '<span class="muted">—</span>' :
        '<div class="hours-adj">' +
          '<div class="stepper">' +
            '<button type="button" onclick="adjHours(' + jq(t.id) + ',-1)">−</button>' +
            '<input type="number" id="adj_' + t.id + '" value="0" oninput="adjHoursChanged(' + jq(t.id) + ')">' +
            '<button type="button" onclick="adjHours(' + jq(t.id) + ',1)">+</button>' +
          '</div>' +
          '<span class="muted" style="font-size:12px">hrs</span>' +
          '<button class="btn sm" id="adjsave_' + t.id + '" style="display:none" onclick="saveHours(' + jq(t.id) + ')">Save</button>' +
        '</div>';
      return '<div class="arow">' +
        '<div class="arow-f arow-f-grow"><span class="arow-f-label">Customer</span>' + esc(t.customer_label || "—") + '<br><span class="muted" style="font-size:12px">' + esc(t.customer_phone || "") + '</span></div>' +
        '<div class="arow-f"><span class="arow-f-label">Status</span>' + status + '</div>' +
        '<div class="arow-f"><span class="arow-f-label">Expires</span>' + fmt(t.expires_at) + '</div>' +
        '<div class="arow-f"><span class="arow-f-label">Adjust validity</span>' + adjust + '</div>' +
        '<div class="arow-f arow-f-actions">' + (expired ? '' : '<button class="btn danger sm" onclick="revoke(' + jq(t.id) + ')">Revoke</button>') + '</div>' +
      '</div>';
    }).join("") + '</div>';
}
async function revoke(id) {
  const { ok } = await api("/api/admin/tokens", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  if (ok) { toast("Revoked"); loadLinks(); }
}

// Adjust an active link's expiry by whole hours. The Save button only appears
// once the value is non-zero, and the change is written only on Save.
function adjHours(id, d) {
  const inp = document.getElementById("adj_" + id);
  if (!inp) return;
  inp.value = (parseInt(inp.value) || 0) + d;
  adjHoursChanged(id);
}
function adjHoursChanged(id) {
  const inp = document.getElementById("adj_" + id);
  const save = document.getElementById("adjsave_" + id);
  if (!inp || !save) return;
  save.style.display = (parseInt(inp.value) || 0) !== 0 ? "inline-flex" : "none";
}
async function saveHours(id) {
  const inp = document.getElementById("adj_" + id);
  const v = parseInt(inp && inp.value) || 0;
  if (!v) return;
  const { ok, data } = await api("/api/admin/tokens", {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, delta_hours: v }),
  });
  if (ok && data && data.ok) { toast(v > 0 ? "Added " + v + "h" : "Removed " + (-v) + "h"); loadLinks(); }
  else toast("Failed");
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
  el.innerHTML = '<div class="arow-list">' +
    rows.map((o) => '<div class="arow">' +
      '<div class="arow-f"><span class="arow-f-label">When</span>' + fmt(o.created_at) + '</div>' +
      '<div class="arow-f arow-f-grow"><span class="arow-f-label">Customer</span>' + esc(o.customer_label || "—") + '</div>' +
      '<div class="arow-f"><span class="arow-f-label">Items</span>' + o.item_count + '</div>' +
      '<div class="arow-f"><span class="arow-f-label">Est. total</span>' + esc(cur) + (o.est_total || 0) + '</div>' +
      '<div class="arow-f arow-f-actions"><button class="btn danger sm" onclick="deleteOrder(' + jq(o.id) + ')">Delete</button></div>' +
    '</div>').join("") +
    '</div>';
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
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
            '<div class="rel-search-wrap" style="flex:1;max-width:none">' +
              '<input class="banner-link-input rel-search" id="bl_' + b.id + '" data-orig="' + esc(b.link_url || '') + '" value="' + esc(b.link_url || '') + '" placeholder="e.g. Handbag" autocomplete="off" oninput="bannerLinkSearch(' + jq('bl_' + b.id) + ');bannerRowDirty(' + jq(b.id) + ')" onblur="setTimeout(function(){closeBannerResults(' + jq('bl_' + b.id) + ')},150)">' +
              '<div class="rel-results" id="bl_' + b.id + '_results" style="display:none"></div>' +
            '</div>' +
            '<button class="btn sm" id="blsave_' + b.id + '" style="display:none" onclick="saveBannerRow(' + jq(b.id) + ')">Save</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:13px;font-weight:normal">' +
              '<input type="checkbox" id="bv_' + b.id + '" data-orig="' + (b.is_active ? '1' : '0') + '" ' + (b.is_active ? 'checked' : '') + ' onchange="bannerRowDirty(' + jq(b.id) + ')" style="width:auto"> Visible' +
            '</label>' +
            '<button class="btn danger sm" onclick="deleteBanner(' + jq(b.id) + ')">Delete</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    ).join('');
  }
  renderCatImgList();
}

// Picking a banner photo opens the crop preview immediately — same flow as
// adding a product photo. The cropper shows both the Desktop (21:8) and Mobile
// (4:3) shapes via the "safe area" overlay, so the ratio is written for both.
async function onBannerFile(fileInput) {
  if (!fileInput.files.length) return;
  const link = document.getElementById("bnr_link").value.trim();
  const bannerRes = await api("/api/admin/banners");
  const currentCount = (bannerRes.data?.banners || []).length;
  if (currentCount >= 5) { fileInput.value = ""; return toast("Maximum 5 banners allowed. Delete one first."); }
  openCropper(fileInput.files[0], { ratio: 16 / 7, title: "Crop banner", ratioLabel: "Homepage banner — each coloured box below shows exactly what that device will display; keep the important part inside all of them", maxEdge: 1600, type: "image/jpeg", quality: 0.85, name: "banner", deviceCrops: [{ name: "Mobile (4:3)", ratio: 4 / 3 }, { name: "Desktop (21:8)", ratio: 21 / 8 }] },
    async (file) => {
      toast("Uploading…");
      const fd = new FormData(); fd.append("file", file); fd.append("link_url", link);
      const res = await fetch("/api/admin/banners", { method: "POST", body: fd });
      fileInput.value = "";
      if (!res.ok) return toast("Upload failed");
      toast("Banner added");
      document.getElementById("bnr_link").value = "";
      loadBanners();
    },
    () => { fileInput.value = ""; }); // reset on cancel so the same file can be re-picked
}

// One Save button covers both the link field and the Visible tick — tapping
// Visible no longer saves immediately, it just marks the row dirty like
// editing the link does; nothing is written until Save is tapped.
function bannerRowDirty(id) {
  const inp = document.getElementById("bl_" + id), cb = document.getElementById("bv_" + id), btn = document.getElementById("blsave_" + id);
  if (!btn) return;
  const linkChanged = inp && inp.value !== (inp.dataset.orig || "");
  const visChanged = cb && (cb.checked ? "1" : "0") !== (cb.dataset.orig || "1");
  btn.style.display = (linkChanged || visChanged) ? "inline-flex" : "none";
}
async function saveBannerRow(id) {
  const inp = document.getElementById("bl_" + id);
  const cb = document.getElementById("bv_" + id);
  const val = inp?.value || "";
  const active = cb ? cb.checked : true;
  const { ok } = await api("/api/admin/banners", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, link_url: val, is_active: active }) });
  if (ok) {
    toast("Saved");
    if (inp) inp.dataset.orig = val;
    if (cb) cb.dataset.orig = active ? "1" : "0";
    const btn = document.getElementById("blsave_" + id);
    if (btn) btn.style.display = "none";
  } else toast("Failed");
}

async function deleteBanner(id) {
  if (!confirm("Delete this banner?")) return;
  const { ok } = await api("/api/admin/banners?id=" + encodeURIComponent(id), { method: "DELETE" });
  if (ok) { toast("Deleted"); loadBanners(); } else toast("Failed");
}

// ---- category images ----
// Two photos per category (Left/Right, both ~4:5). Desktop shows both
// side-by-side with the shop logo + category name in the gap; mobile loops
// both photos one at a time; the admin picks which one (Left or Right) feeds
// the homepage tile — so the same two uploads cover every placement.
// Best single thumbnail for a side: prefer the independently-framed "tile"
// crop (closest to a portrait preview), then mobile/desktop, then the legacy
// plain upload — mirrors the fallback order the customer site uses.
function catImgThumb(row, side) {
  if (row[side + "_image_url"]) return row[side + "_image_url"];
  let variants = {};
  try { variants = JSON.parse(row[side + "_variants_json"] || "{}") || {}; } catch (e) {}
  return (variants.tile && variants.tile.url) || (variants.mobile && variants.mobile.url) || (variants.desktop && variants.desktop.url) || "";
}

function renderCatImgList() {
  const el = document.getElementById("catImgList");
  if (!el) return;
  const cats = [...new Set(ARTICLES.map(a => a.category).filter(Boolean))];
  if (!cats.length) { el.innerHTML = '<p class="muted">No categories yet. Add articles first.</p>'; return; }
  el.innerHTML = cats.map(c => {
    const row = CAT_IMAGES[c] || {};
    const left = catImgThumb(row, "left");
    const right = catImgThumb(row, "right");
    const tileSrc = row.tile_source === "right" ? "right" : "left";
    const hasBoth = !!(left && right);

    const slot = (side, url) =>
      '<div class="cat-img-slot">' +
        '<div class="cat-img-thumb">' +
          (url ? '<img src="' + esc(url) + '" alt="' + esc(c) + ' ' + side + '">' : '<div class="cat-img-empty">No photo</div>') +
        '</div>' +
        '<div class="cat-img-slot-foot">' +
          '<span class="cat-img-slot-label">' + (side === "left" ? "Left" : "Right") + '</span>' +
          (url ? '<button class="btn sm ghost" onclick="adjustCatImg(' + jq(c) + ',' + jq(side) + ')">Adjust</button>' : '') +
          '<label class="btn sm ghost" style="cursor:pointer;margin:0">' + (url ? "Replace" : "Upload") +
            '<input type="file" accept="image/*" style="display:none;width:0" onchange="uploadCatImg(' + jq(c) + ',' + jq(side) + ',this)"></label>' +
          (url ? '<button class="btn danger sm" onclick="deleteCatImg(' + jq(c) + ',' + jq(side) + ')">✕</button>' : '') +
        '</div>' +
      '</div>';

    const segToggle = (which, current) =>
      '<div class="seg-toggle">' +
        '<button type="button" class="' + (current === "left" ? "on" : "") + '" onclick="setCatImgSource(' + jq(c) + ',' + jq(which) + ',' + jq("left") + ')">Left</button>' +
        '<button type="button" class="' + (current === "right" ? "on" : "") + '" onclick="setCatImgSource(' + jq(c) + ',' + jq(which) + ',' + jq("right") + ')">Right</button>' +
      '</div>';

    const selectors = hasBoth
      ? '<div class="cat-img-selectors">' +
          '<div class="cat-img-select-row"><span class="cat-img-select-label">Homepage tile shows</span>' + segToggle("tile", tileSrc) + '</div>' +
        '</div>'
      : '<p class="muted" style="font-size:11px;margin-top:6px">Add a Right photo to unlock the desktop split banner (mobile then loops both), and to choose which one shows on the homepage tile.</p>';

    return '<div class="cat-img-item">' +
      '<div class="cat-img-item-head"><strong style="font-size:13.5px">' + esc(c) + '</strong></div>' +
      '<div class="cat-img-slots">' + slot("left", left) + slot("right", right) + '</div>' +
      selectors +
    '</div>';
  }).join('');
}

// One uploaded photo, three independently-framed crops (tile/mobile/desktop) —
// the admin picks a tab in the cropper and drags/zooms just that placement,
// so e.g. the wide desktop header can be framed differently from the tall
// homepage tile instead of relying on one shared centred crop for both.
// Desktop ratio tracks the actual on-page shape of each photo in the split
// header — the wider the middle logo/name card, the narrower each side photo
// gets relative to its height. Keep this in sync with .cat-hero-split-mid's
// min-width in styles.css if that's ever changed again.
const CAT_IMG_TARGETS = [
  { key: "desktop", name: "Desktop header (2:1)", ratio: 2 / 1 },
  { key: "mobile", name: "Mobile header (3:2)", ratio: 3 / 2 },
  { key: "tile", name: "Homepage tile (3:4)", ratio: 3 / 4 },
];

// initialRects (optional): { [targetKey]: {x,y,w,h} } — previously-saved crop
// rectangles (fractions of the source image) to reopen each tab showing what
// was actually framed last time, instead of resetting to a centred default.
function openCatImgCropper(category, side, file, initialRects) {
  openCropper(file, {
    perTargetAdjust: true,
    title: "Crop category photo (" + (side === "right" ? "Right" : "Left") + ")",
    ratioLabel: "This photo is shown at a few sizes — frame each one separately so the subject looks right everywhere.",
    maxEdge: 1600, type: "image/jpeg", quality: 0.85, name: "category-" + side,
    deviceCrops: CAT_IMG_TARGETS,
    initialRects,
  }, async (out) => {
    toast("Uploading…");
    if (!CAT_IMAGES[category]) CAT_IMAGES[category] = { category, mobile_source: "left", tile_source: "left" };
    let lastUrl = "";
    // Rebuild the side's variants locally from what we just saved, so an
    // immediate "Adjust" (no page reload in between) sees the fresh rects —
    // relying on the next GET would show stale/absent data until reload.
    const variants = {};
    for (const dc of CAT_IMG_TARGETS.concat([{ key: "original" }])) {
      const fd = new FormData();
      fd.append("file", out[dc.key].file); fd.append("category", category); fd.append("side", side); fd.append("target", dc.key);
      if (out[dc.key].rect) fd.append("rect", JSON.stringify(out[dc.key].rect));
      const res = await fetch("/api/admin/category-images", { method: "POST", body: fd });
      if (!res.ok) { toast("Upload failed"); renderCatImgList(); return; }
      const data = await res.json();
      variants[dc.key] = out[dc.key].rect ? { url: data.image_url, rect: out[dc.key].rect } : { url: data.image_url };
      if (dc.key !== "original") lastUrl = data.image_url;
    }
    CAT_IMAGES[category][side + "_variants_json"] = JSON.stringify(variants);
    // Keep a plain fallback url too (used for admin thumbnails / older code paths).
    CAT_IMAGES[category][side + "_image_url"] = lastUrl;
    toast("Photo saved");
    renderCatImgList();
  });
}

async function uploadCatImg(category, side, input) {
  if (!input.files.length) return;
  const file = input.files[0];
  input.value = "";
  openCatImgCropper(category, side, file);
}

// Re-open the cropper on the photo already uploaded for this side, without
// making the admin pick the file again — reframes from the saved unmodified
// original when available, or the best existing crop for older photos that
// predate the "original" being kept. Each tab is seeded with its previously
// saved crop rectangle so it shows the actual framing chosen last time.
async function adjustCatImg(category, side) {
  const row = CAT_IMAGES[category] || {};
  let variants = {};
  try { variants = JSON.parse(row[side + "_variants_json"] || "{}") || {}; } catch (e) {}
  const src = (variants.original && variants.original.url) || catImgThumb(row, side);
  if (!src) return toast("No photo to adjust");
  toast("Loading photo…");
  const res = await fetch(src);
  if (!res.ok) return toast("Could not load photo");
  const blob = await res.blob();
  const file = new File([blob], "category-" + side + ".jpg", { type: blob.type || "image/jpeg" });
  // Rects were saved relative to the true original — only trustworthy to
  // reuse when we actually loaded the original just now (not a fallback crop).
  const initialRects = variants.original ? {} : undefined;
  if (initialRects) {
    CAT_IMG_TARGETS.forEach((dc) => { if (variants[dc.key] && variants[dc.key].rect) initialRects[dc.key] = variants[dc.key].rect; });
  }
  openCatImgCropper(category, side, file, initialRects);
}

async function deleteCatImg(category, side) {
  if (!confirm("Remove the " + side + " photo for \"" + category + "\"?")) return;
  const { ok } = await api("/api/admin/category-images?category=" + encodeURIComponent(category) + "&side=" + encodeURIComponent(side), { method: "DELETE" });
  if (ok) {
    if (CAT_IMAGES[category]) { CAT_IMAGES[category][side + "_image_url"] = ""; CAT_IMAGES[category][side + "_variants_json"] = ""; }
    toast("Removed");
    renderCatImgList();
  } else toast("Failed");
}

// which: "mobile" | "tile" — side: "left" | "right"
async function setCatImgSource(category, which, side) {
  const body = { category }; body[which + "_source"] = side;
  const { ok } = await api("/api/admin/category-images", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!ok) return toast("Failed");
  if (!CAT_IMAGES[category]) CAT_IMAGES[category] = { category };
  CAT_IMAGES[category][which + "_source"] = side;
  renderCatImgList();
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
