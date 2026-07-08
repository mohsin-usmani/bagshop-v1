const TOKEN = qs("t");
let DATA = null;
let CUR = "Rs.";
let SHOW_PRICES = true;
const FILTER = { category: "", color: "", size: "", price_min: "", price_max: "", q: "" };
let CHIP_OPEN = ""; // which chip panel is open
const CART = {};
const PHOTO_IDX = {};
const SELECTION = {}; // articleId -> { color, size, qty }
let MODAL_AID = null;

const COLOR_CSS = {
  'Black':'#1C1C1C','Brown':'#7B4B2A','Red':'#CC2200','Beige':'#D4B896',
  'Navy':'#1B2A6B','Cream':'#F0E6CC','Green':'#2E7D32','Pink':'#E91E63',
  'White':'#EBEBEB','Grey':'#757575','Blue':'#1565C0','Olive':'#6D7B2C',
  'Tan':'#C8965C','Burgundy':'#7B1A2A','Gold':'#C9962E','Purple':'#6A1B9A',
};

async function load() {
  if (!TOKEN) return showExpired();
  const p = new URLSearchParams({ token: TOKEN });
  if (FILTER.category)  p.set("category",  FILTER.category);
  if (FILTER.color)     p.set("color",     FILTER.color);
  if (FILTER.size)      p.set("size",      FILTER.size);
  if (FILTER.price_min) p.set("price_min", FILTER.price_min);
  if (FILTER.price_max) p.set("price_max", FILTER.price_max);
  if (FILTER.q)         p.set("q",         FILTER.q);
  const { ok, status, data } = await api("/api/catalog?" + p.toString());
  if (status === 403) return showExpired();
  if (!ok || !data) return document.getElementById("app").innerHTML = '<div class="notice">Could not load. Please try again.</div>';
  DATA = data;
  CUR = data.shop.currency || "Rs.";
  SHOW_PRICES = !!data.shop.show_prices;
  render();
}

function showExpired() {
  document.getElementById("cartbar").style.display = "none";
  document.getElementById("app").innerHTML =
    '<div class="notice card"><h2>Link expired</h2>' +
    '<p class="muted">This catalogue link is no longer active. Please message us on WhatsApp to get a fresh link.</p></div>';
}

function render() {
  const first = !document.getElementById("grid");
  const f = DATA.filters;
  const app = document.getElementById("app");

  if (first) {
    app.innerHTML =
      '<div class="topbar"><div class="wrap">' +
        '<div><div class="shopname">' + esc(DATA.shop.name) + '</div>' +
        (DATA.customer ? '<div class="topbar-cust">' + esc(DATA.customer) + '</div>' : '') +
        '</div>' +
      '</div></div>' +
      '<div class="filter-bar" id="filterBar">' +
        '<div class="fcat-row" id="catRow"></div>' +
        '<div class="fchips-row" id="fchipsRow">' +
          '<div id="fchips"></div>' +
          '<div class="search-box fbar-search"><svg class="search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input id="search" placeholder="Search…"></div>' +
        '</div>' +
        '<div class="fpanel" id="fpanel" hidden></div>' +
      '</div>' +
      '<div class="wrap" style="padding-top:0"><div class="grid" id="grid"></div></div>';
    document.getElementById("search").addEventListener("input", debounce((e) => { FILTER.q = e.target.value.trim(); load(); }, 300));
    document.addEventListener("click", function(e) {
      if (!e.target.closest("#fchips") && !e.target.closest("#fpanel")) closeChips();
    });
  }

  // Category pills
  const catRow = document.getElementById("catRow");
  catRow.innerHTML =
    '<span class="fpill' + (FILTER.category === "" ? " on" : "") + '" onclick="setF(\'category\',\'\')">All</span>' +
    f.categories.map(c =>
      '<span class="fpill' + (FILTER.category === c ? " on" : "") + '" onclick="setF(\'category\',' + jq(c) + ')">' + esc(c) + '</span>'
    ).join("");

  // Filter chips
  const hasPrice = FILTER.price_min !== "" || FILTER.price_max !== "";
  function chip(id, label, active) {
    return '<button class="fchip' + (active ? " on" : "") + '" id="fch-' + id + '" onclick="openChip(' + jq(id) + ')">' +
      esc(label) +
      (active
        ? ' <span class="fchip-x" onclick="event.stopPropagation();clearF(' + jq(id) + ')">×</span>'
        : ' <span class="fchip-arr">▾</span>') +
    '</button>';
  }
  document.getElementById("fchips").innerHTML =
    chip("color", FILTER.color ? "Color: " + FILTER.color : "Color", !!FILTER.color) +
    chip("size",  FILTER.size  ? "Size: "  + FILTER.size  : "Size",  !!FILTER.size) +
    chip("price", hasPrice ? getPriceLabel() : "Price", hasPrice);

  const grid = document.getElementById("grid");
  grid.innerHTML = DATA.articles.length
    ? DATA.articles.map(articleCard).join("")
    : '<p class="muted">No items match. Try clearing filters.</p>';
  initCardSwipe();
  renderCart();
}

// ---- card color helpers ----
function cardColor(a) {
  if (SELECTION[a.id] && SELECTION[a.id].color) return SELECTION[a.id].color;
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  // respect active colour filter so filtered cards show the right photo
  if (FILTER.color && colors.includes(FILTER.color)) return FILTER.color;
  return colors[0] || '';
}
function cardPhotos(a) {
  const selColor = cardColor(a);
  const all = a.photos || [];
  const filtered = all.filter(p => p.color === selColor);
  return filtered.length ? filtered : all;
}
function selectCardColor(aid, color) {
  if (!SELECTION[aid]) SELECTION[aid] = { qty: 1 };
  SELECTION[aid].color = color;
  SELECTION[aid].size = null;
  PHOTO_IDX[aid] = 0;
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const pwEl = document.getElementById('pw-' + aid);
  if (pwEl) pwEl.innerHTML = photoWrapHTML(a); // rebuilds swatches with correct .on state
  const cnEl = document.getElementById('cn-' + aid);
  if (cnEl) cnEl.textContent = color;
}

// ---- card: photo (with overlays) + name + price ----
function photoWrapHTML(a) {
  const photos = cardPhotos(a);
  const selColor = cardColor(a);
  const idx = Math.min(PHOTO_IDX[a.id] || 0, Math.max(0, photos.length - 1));
  const cartQty = a.variants.reduce((n, v) => n + (CART[v.id] ? CART[v.id].qty : 0), 0);

  const img = photos.length
    ? '<img src="' + esc(photos[idx].url) + '" alt="" loading="lazy">'
    : '<div class="no-photo">No photo</div>';
  const dots = photos.length > 1
    ? '<div class="photo-dots">' + photos.map((_, i) =>
        '<span class="photo-dot' + (i === idx ? ' on' : '') + '" onclick="event.stopPropagation();goPhoto(' + jq(a.id) + ',' + i + ')"></span>'
      ).join('') + '</div>'
    : '';

  // stock overlay (only low/out — clean cards for in-stock)
  const totalQty = a.variants.reduce((n, v) => n + (v.available_qty || 0), 0);
  const stockOverlay = totalQty === 0
    ? '<div class="card-stk out">Out of stock</div>'
    : totalQty < 10 ? '<div class="card-stk low">Only ' + totalQty + ' left</div>' : '';

  return (photos.length > 1 ? '<button class="slide-btn prev" onclick="event.stopPropagation();prevPhoto(' + jq(a.id) + ')">&#8249;</button>' : '') +
    img +
    (photos.length > 1 ? '<button class="slide-btn next" onclick="event.stopPropagation();nextPhoto(' + jq(a.id) + ')">&#8250;</button>' : '') +
    dots +
    (cartQty ? '<div class="photo-badge">' + cartQty + ' in cart</div>' : '') +
    stockOverlay;
}

function articleCard(a) {
  let minPrice = a.base_price;
  a.variants.forEach(v => {
    const p = v.price != null ? v.price : a.base_price;
    if (p != null && (minPrice == null || p < minPrice)) minPrice = p;
  });
  const priceHtml = SHOW_PRICES && minPrice != null
    ? '<div class="card-price">' + esc(CUR) + ' ' + minPrice + '/pc</div>'
    : '';
  const colorCount = [...new Set(a.variants.map(v => v.color).filter(Boolean))].length;
  const colorHint = colorCount > 1 ? '<div class="card-color-hint">+' + (colorCount - 1) + ' more colors</div>' : '';

  return '<div class="card prod" onclick="openDetail(' + jq(a.id) + ')">' +
    '<div class="photo-wrap" id="pw-' + a.id + '">' + photoWrapHTML(a) + '</div>' +
    '<div class="prod-info">' +
      '<div class="pname">' + esc(a.name || a.article_code) + '</div>' +
      priceHtml +
      colorHint +
    '</div>' +
    '</div>';
}

function prevPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const photos = cardPhotos(a); if (!photos.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + photos.length) % photos.length;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}
function nextPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const photos = cardPhotos(a); if (!photos.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % photos.length;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}
function goPhoto(aid, idx) {
  PHOTO_IDX[aid] = idx;
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}

// ---- product detail modal ----
function openDetail(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  MODAL_AID = aid;
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const prev = SELECTION[aid] || {};

  // color: filter wins > keep previous > first
  const defaultColor =
    (FILTER.color && colors.includes(FILTER.color)) ? FILTER.color :
    (prev.color && colors.includes(prev.color)) ? prev.color :
    colors[0] || '';

  // size: filter match > only one option for this color > keep previous > null
  const colVarsAvail = a.variants.filter(v => v.color === defaultColor && v.available_qty > 0);
  let defaultSize = null;
  if (FILTER.size && colVarsAvail.find(v => v.size === FILTER.size)) {
    defaultSize = FILTER.size;
  } else if (colVarsAvail.length === 1) {
    defaultSize = colVarsAvail[0].size;
  } else if (prev.size && colVarsAvail.find(v => v.size === prev.size)) {
    defaultSize = prev.size;
  }

  SELECTION[aid] = { color: defaultColor, size: defaultSize, qty: prev.qty || 1 };
  PHOTO_IDX[aid] = 0;
  document.querySelector('#prodModal .prod-modal-body').innerHTML = detailHTML(a);
  document.getElementById('prodModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  attachModalSwipe();
}
function closeDetail() {
  document.getElementById('prodModal').classList.remove('open');
  document.body.style.overflow = '';
  MODAL_AID = null;
}
function refreshModal() {
  if (!MODAL_AID) return;
  const a = DATA.articles.find(x => x.id === MODAL_AID); if (!a) return;
  document.querySelector('#prodModal .prod-modal-body').innerHTML = detailHTML(a);
  attachModalSwipe();
}
function selectColor(aid, color) {
  if (!SELECTION[aid]) SELECTION[aid] = { qty: 1 };
  SELECTION[aid].color = color;
  PHOTO_IDX[aid] = 0;
  // auto-select size: filter match > only one in-stock option > null
  const a = DATA.articles.find(x => x.id === aid);
  const avail = a ? a.variants.filter(v => v.color === color && v.available_qty > 0) : [];
  if (FILTER.size && avail.find(v => v.size === FILTER.size)) {
    SELECTION[aid].size = FILTER.size;
  } else if (avail.length === 1) {
    SELECTION[aid].size = avail[0].size;
  } else {
    SELECTION[aid].size = null;
  }
  refreshModal();
}
function selectSize(aid, size) {
  if (!SELECTION[aid]) SELECTION[aid] = { qty: 1 };
  SELECTION[aid].size = size;
  SELECTION[aid].qty = 1;
  refreshModal();
}
function modalChg(aid, delta) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const sel = SELECTION[aid] || {};
  const v = a.variants.find(x => x.color === sel.color && x.size === sel.size);
  const max = v ? v.available_qty : 1;
  setModalQty(aid, (sel.qty || 1) + delta, max);
}
function setModalQty(aid, val, max) {
  if (!SELECTION[aid]) SELECTION[aid] = {};
  let q = parseInt(val) || 1;
  if (q < 1) q = 1;
  if (max != null && q > max) { q = max; toast("Only " + max + " in stock"); }
  SELECTION[aid].qty = q;
  const inp = document.querySelector('#prodModal .modal-qty-input');
  if (inp) inp.value = q;
}
function addToCart(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const sel = SELECTION[aid] || {};
  if (!sel.color) return toast("Please select a colour");
  if (!sel.size)  return toast("Please select a size");
  const v = a.variants.find(x => x.color === sel.color && x.size === sel.size);
  if (!v || v.available_qty <= 0) return toast("Out of stock");
  const qty = sel.qty || 1;
  const price = v.price != null ? v.price : a.base_price;
  const label = a.article_code + " " + sel.color + " " + sel.size;
  if (CART[v.id]) {
    CART[v.id].qty = Math.min(CART[v.id].qty + qty, v.available_qty);
  } else {
    CART[v.id] = { qty, label, price };
  }
  SELECTION[aid].qty = 1;
  toast("Added to cart");
  renderCart();
  refreshModal();
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}

const IC_BAG = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
const IC_OK  = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
const IC_FIRE= '⚡';

function detailHTML(a) {
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const sel = SELECTION[a.id] || {};
  const selColor = sel.color || colors[0] || '';
  const selSize  = sel.size || null;
  const colVars  = a.variants.filter(v => v.color === selColor);

  // photos for selected colour
  const colorPhotos = (a.photos || []).filter(p => p.color === selColor);
  const showPhotos  = colorPhotos.length ? colorPhotos : (a.photos || []);
  const idx = Math.min(PHOTO_IDX[a.id] || 0, Math.max(0, showPhotos.length - 1));

  // price for selected colour
  let minPrice = null;
  colVars.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (minPrice == null || p < minPrice)) minPrice = p; });
  if (minPrice == null) a.variants.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (minPrice == null || p < minPrice)) minPrice = p; });

  // ── photo area ──
  const bigImg = showPhotos.length
    ? '<img src="' + esc(showPhotos[idx].url) + '" alt="" class="modal-big-img">'
    : '<div class="no-photo" style="height:220px">No photo</div>';
  const dots = showPhotos.length > 1
    ? '<div class="photo-dots" style="bottom:8px;z-index:2">' + showPhotos.map((_, i) =>
        '<span class="photo-dot' + (i === idx ? ' on' : '') + '" onclick="goModalPhoto(' + jq(a.id) + ',' + i + ')"></span>'
      ).join('') + '</div>' : '';
  const thumbs = showPhotos.length > 1
    ? '<div class="modal-thumbs">' + showPhotos.map((p, i) =>
        '<img src="' + esc(p.url) + '" class="modal-ptb' + (i === idx ? ' on' : '') + '" onclick="goModalPhoto(' + jq(a.id) + ',' + i + ')" loading="lazy">'
      ).join('') + '</div>' : '';

  // ── colour photo thumbnails (Myntra "MORE COLORS" style) ──
  const swatches = colors.length > 1
    ? '<div class="more-colors-label">MORE COLORS <span class="more-colors-selected">— ' + esc(selColor) + '</span></div>' +
      '<div class="color-photo-row">' +
        colors.map(c => {
          const cPhoto = (a.photos || []).find(p => p.color === c);
          const inner = cPhoto
            ? '<img src="' + esc(cPhoto.url) + '" alt="' + esc(c) + '" loading="lazy">'
            : '<div style="width:100%;height:100%;background:' + (COLOR_CSS[c] || '#ccc') + ';border-radius:8px"></div>';
          return '<div class="color-photo-thumb' + (c === selColor ? ' on' : '') + '" onclick="selectColor(' + jq(a.id) + ',' + jq(c) + ')" title="' + esc(c) + '">' + inner + '</div>';
        }).join('') +
      '</div>'
    : (colors.length === 1
        ? '<div class="more-colors-label">COLOUR <span class="more-colors-selected">— ' + esc(selColor) + '</span></div>'
        : '');

  // ── size chips ──
  const sizeChips = colVars.length
    ? '<div class="modal-section-label" style="margin-top:14px">SIZE</div>' +
      '<div class="size-chip-row" style="margin-top:10px">' +
        colVars.map(v =>
          '<button class="size-chip' + (v.size === selSize ? ' on' : '') + (v.available_qty === 0 ? ' disabled' : '') + '" ' +
          (v.available_qty > 0 ? 'onclick="selectSize(' + jq(a.id) + ',' + jq(v.size) + ')"' : 'disabled') + '>' +
          esc(v.size || '—') + '</button>'
        ).join('') +
      '</div>'
    : '';

  // ── add to cart ──
  let addSection = '';
  if (selSize) {
    const sv = colVars.find(v => v.size === selSize);
    if (sv && sv.available_qty > 0) {
      const price = sv.price ?? a.base_price;
      const qty   = sel.qty || 1;
      const inCart = CART[sv.id] ? CART[sv.id].qty : 0;
      const stockPill = sv.available_qty < 10
        ? '<span class="modal-stock-pill low">' + IC_FIRE + ' Only ' + sv.available_qty + ' left</span>'
        : '<span class="modal-stock-pill good">' + IC_OK + ' In stock</span>';
      addSection =
        '<div class="modal-divider"></div>' +
        '<div class="modal-add-section">' +
          stockPill +
          '<div class="modal-qty-row">' +
            '<span class="modal-qty-label">QTY</span>' +
            '<div class="stepper">' +
              '<button onclick="modalChg(' + jq(a.id) + ',-1)">−</button>' +
              '<input type="number" class="modal-qty-input" min="1" max="' + sv.available_qty + '" value="' + qty + '" onchange="setModalQty(' + jq(a.id) + ',this.value,' + sv.available_qty + ')">' +
              '<button onclick="modalChg(' + jq(a.id) + ',1)">+</button>' +
            '</div>' +
            (SHOW_PRICES && price != null ? '<span style="font-size:16px;font-weight:800;color:var(--ink);margin-left:auto">' + esc(CUR) + ' ' + price + '/pc</span>' : '') +
          '</div>' +
          '<button class="btn-add-cart" onclick="addToCart(' + jq(a.id) + ')">' +
            IC_BAG + 'Add to Cart' +
            (SHOW_PRICES && price != null ? '<span class="btn-price">· ' + esc(CUR) + ' ' + (price * qty) + '</span>' : '') +
          '</button>' +
          (inCart ? '<div class="modal-in-cart">' + IC_OK + ' ' + inCart + ' pc already in your cart</div>' : '') +
        '</div>';
    } else if (sv) {
      addSection = '<div class="modal-divider"></div><div style="padding:14px 0;color:#C0563F;font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>This size is out of stock</div>';
    }
  } else if (colVars.length) {
    addSection = '<div class="modal-divider"></div><div style="padding:14px 0;color:var(--muted);font-size:13.5px;text-align:center">Select a size to continue →</div>';
  }

  return '<div class="modal-photo-area">' +
      (showPhotos.length > 1 ? '<button class="slide-btn prev" onclick="prevDPhoto(' + jq(a.id) + ')">&#8249;</button>' : '') +
      bigImg +
      (showPhotos.length > 1 ? '<button class="slide-btn next" onclick="nextDPhoto(' + jq(a.id) + ')">&#8250;</button>' : '') +
      dots +
    '</div>' +
    thumbs +
    '<div class="modal-info">' +
      '<div class="modal-meta-row">' +
        '<span class="modal-code-tag">' + esc(a.article_code) + '</span>' +
        '<span class="modal-cat-tag">' + esc(a.category) + '</span>' +
      '</div>' +
      '<div class="modal-name">' + esc(a.name || '') + '</div>' +
      (SHOW_PRICES && minPrice != null
        ? '<div class="modal-price-row"><span class="modal-price">' + esc(CUR) + ' ' + minPrice + '</span><span class="modal-price-note">per piece</span></div>'
        : '') +
      (a.description ? '<p class="desc-text">' + esc(a.description) + '</p>' : '') +
      '<div class="modal-divider"></div>' +
      swatches +
      sizeChips +
      addSection +
    '</div>';
}

function prevDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const photos = modalPhotos(a);
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + photos.length) % photos.length;
  refreshModal();
}
function nextDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const photos = modalPhotos(a);
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % photos.length;
  refreshModal();
}
function goModalPhoto(aid, idx) { PHOTO_IDX[aid] = idx; refreshModal(); }
function modalPhotos(a) {
  const sel = (SELECTION[a.id] || {}).color || '';
  const cp = (a.photos || []).filter(p => p.color === sel);
  return cp.length ? cp : (a.photos || []);
}

// ---- swipe gestures ----
function initCardSwipe() {
  const grid = document.getElementById('grid');
  if (!grid || grid._sw) return;
  grid._sw = true;
  let sx = 0, swAid = null, didSwipe = false;
  grid.addEventListener('touchstart', e => {
    const pw = e.target.closest('[id^="pw-"]');
    didSwipe = false;
    if (pw) { sx = e.touches[0].clientX; swAid = pw.id.slice(3); }
    else swAid = null;
  }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (!swAid) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) {
      didSwipe = true;
      if (dx < 0) nextPhoto(swAid); else prevPhoto(swAid);
    }
    swAid = null;
  }, { passive: true });
  grid.addEventListener('click', e => {
    if (didSwipe) { e.stopPropagation(); didSwipe = false; }
  }, true);
}
function attachModalSwipe() {
  const area = document.querySelector('#prodModal .modal-photo-area');
  if (!area) return;
  let sx = 0;
  area.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  area.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40 && MODAL_AID) { if (dx < 0) nextDPhoto(MODAL_AID); else prevDPhoto(MODAL_AID); }
  }, { passive: true });
}

// ---- filters ----
function setF(k, v) {
  if (k === "price") return; // price uses setPrice()
  FILTER[k] = v;
  closeChips();
  load();
}
function clearF(k) {
  if (k === "price") { FILTER.price_min = ""; FILTER.price_max = ""; }
  else FILTER[k] = "";
  closeChips();
  load();
}
function getPriceLabel() {
  const mn = FILTER.price_min, mx = FILTER.price_max;
  if (!mn && mx)  return "Under " + CUR + mx;
  if (mn && !mx)  return CUR + mn + "+";
  if (mn && mx)   return CUR + mn + "–" + CUR + mx;
  return "Price";
}
function openChip(id) {
  const panel = document.getElementById("fpanel"); if (!panel) return;
  if (CHIP_OPEN === id) { closeChips(); return; }
  CHIP_OPEN = id;
  panel.hidden = false;
  if (id === "color") {
    panel.innerHTML = DATA.filters.colors.map(c =>
      '<button class="fopt' + (FILTER.color === c ? " on" : "") + '" onclick="setF(\'color\',' + jq(c) + ')">' +
        '<span class="fopt-dot" style="background:' + (COLOR_CSS[c] || '#999') + '"></span>' + esc(c) +
      '</button>'
    ).join("");
  } else if (id === "size") {
    panel.innerHTML = DATA.filters.sizes.map(s =>
      '<button class="fopt' + (FILTER.size === s ? " on" : "") + '" onclick="setF(\'size\',' + jq(s) + ')">' + esc(s) + '</button>'
    ).join("");
  } else if (id === "price") {
    const ranges = [
      { label: "Under " + CUR + "500",           min: "",     max: "499"  },
      { label: CUR + "500 – " + CUR + "999",     min: "500",  max: "999"  },
      { label: CUR + "1000 – " + CUR + "1999",   min: "1000", max: "1999" },
      { label: CUR + "2000+",                     min: "2000", max: ""     },
    ];
    panel.innerHTML = ranges.map(r => {
      const active = FILTER.price_min === r.min && FILTER.price_max === r.max;
      return '<button class="fopt' + (active ? " on" : "") + '" onclick="setPrice(' + jq(r.min) + ',' + jq(r.max) + ')">' + esc(r.label) + '</button>';
    }).join("");
  }
}
function closeChips() {
  CHIP_OPEN = "";
  const p = document.getElementById("fpanel"); if (p) p.hidden = true;
}
function setPrice(mn, mx) {
  FILTER.price_min = mn; FILTER.price_max = mx;
  closeChips();
  load();
}

// ---- cart ----
function renderCart() {
  const ids   = Object.keys(CART);
  const count = ids.reduce((n, id) => n + CART[id].qty, 0);
  document.getElementById("cartbar").style.display = ids.length ? "block" : "none";
  document.getElementById("cartCount").textContent = count;
  let total = 0;
  document.getElementById("cartLines").innerHTML = ids.map((id) => {
    const c = CART[id]; total += (c.price || 0) * c.qty;
    return '<div class="line"><div>' + esc(c.label) + ' <span class="muted">&#215; ' + c.qty + '</span></div>' +
      (SHOW_PRICES ? '<div class="muted">' + esc(CUR) + (c.price * c.qty) + '</div>' : '') +
      '<span class="x" onclick="removeItem(' + jq(id) + ')">&#10005;</span></div>';
  }).join("") || '<p class="muted">Cart is empty.</p>';
  document.getElementById("cartTotal").innerHTML = SHOW_PRICES && ids.length ? 'Indicative total: ' + esc(CUR) + total : '';
}
function removeItem(id) {
  delete CART[id];
  renderCart();
  if (DATA) {
    const a = DATA.articles.find(x => x.variants.some(v => v.id === id));
    if (a) { const el = document.getElementById('pw-' + a.id); if (el) el.innerHTML = photoWrapHTML(a); }
  }
}
function openCart()  { document.getElementById("drawer").classList.add("open"); }
function closeCart() { document.getElementById("drawer").classList.remove("open"); }

async function sendOrder() {
  const items = Object.keys(CART).map((id) => ({ variant_id: id, qty: CART[id].qty }));
  if (!items.length) return toast("Cart is empty");
  const { ok, status, data } = await api("/api/order", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: TOKEN, items }),
  });
  if (status === 403) return showExpired();
  if (ok && data && data.whatsapp) { window.location.href = data.whatsapp; }
  else toast("Could not send. Please try again.");
}

// ---- utils ----
function stockLabel(qty, size) {
  if (qty < 10) return '<span style="font-size:' + size + ';color:#C0563F;font-weight:700">Only ' + qty + ' left!</span>';
  return '<span style="font-size:' + size + ';color:#0E6B57;font-weight:600">In stock</span>';
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function jq(s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; }

load();
