const TOKEN = qs("t");
let DATA = null;
let CUR = "Rs.";
let SHOW_PRICES = true;
const FILTER = { category: "", color: "", size: "", q: "" };
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
  if (FILTER.category) p.set("category", FILTER.category);
  if (FILTER.color)    p.set("color",    FILTER.color);
  if (FILTER.size)     p.set("size",     FILTER.size);
  if (FILTER.q)        p.set("q",        FILTER.q);
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
        '<div class="shopname">' + esc(DATA.shop.name) + '</div>' +
        (DATA.customer ? '<div style="font-size:13px;opacity:.9">' + esc(DATA.customer) + '</div>' : '') +
      '</div></div>' +
      '<div class="wrap">' +
        '<div class="filters"><div class="row" id="catRow"></div>' +
        '<div class="row" style="margin-top:8px" id="cvRow"></div>' +
        '<div class="row" style="margin-top:8px"><input id="search" placeholder="Search article code or name…" style="max-width:320px"></div>' +
        '</div><div class="grid" id="grid"></div></div>';
    document.getElementById("search").addEventListener("input", debounce((e) => { FILTER.q = e.target.value.trim(); load(); }, 300));
  }

  const catRow = document.getElementById("catRow");
  catRow.innerHTML = '<span class="pill ' + (FILTER.category === "" ? "on" : "") + '" onclick="setF(\'category\',\'\')">All types</span>' +
    f.categories.map((c) => '<span class="pill ' + (FILTER.category === c ? "on" : "") + '" onclick="setF(\'category\',' + jq(c) + ')">' + esc(c) + '</span>').join("");

  const cvRow = document.getElementById("cvRow");
  cvRow.innerHTML =
    '<select onchange="setF(\'color\',this.value)" style="max-width:160px"><option value="">All colours</option>' +
      f.colors.map((c) => '<option ' + (FILTER.color === c ? "selected" : "") + '>' + esc(c) + '</option>').join("") + '</select>' +
    '<select onchange="setF(\'size\',this.value)" style="max-width:150px"><option value="">All sizes</option>' +
      f.sizes.map((s) => '<option ' + (FILTER.size === s ? "selected" : "") + '>' + esc(s) + '</option>').join("") + '</select>';

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
  if (pwEl) pwEl.innerHTML = photoWrapHTML(a);
  const cnEl = document.getElementById('cn-' + aid);
  if (cnEl) cnEl.textContent = color;
  const swEl = document.getElementById('sw-' + aid);
  if (swEl) swEl.querySelectorAll('.csw').forEach(s => s.classList.toggle('on', s.dataset.color === color));
}

// ---- card: photo + name + price + color swatches ----
function photoWrapHTML(a) {
  const photos = cardPhotos(a);
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
  return (photos.length > 1 ? '<button class="slide-btn prev" onclick="event.stopPropagation();prevPhoto(' + jq(a.id) + ')">&#8249;</button>' : '') +
    img +
    (photos.length > 1 ? '<button class="slide-btn next" onclick="event.stopPropagation();nextPhoto(' + jq(a.id) + ')">&#8250;</button>' : '') +
    dots +
    (cartQty ? '<div class="photo-badge">' + cartQty + ' in cart</div>' : '');
}

function articleCard(a) {
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const selColor = cardColor(a);

  let minPrice = a.base_price;
  a.variants.forEach(v => {
    const p = v.price != null ? v.price : a.base_price;
    if (p != null && (minPrice == null || p < minPrice)) minPrice = p;
  });
  const priceHtml = SHOW_PRICES && minPrice != null
    ? '<div class="card-price">' + esc(CUR) + minPrice + '/pc</div>'
    : '';

  const totalQty = a.variants.reduce((n, v) => n + (v.available_qty || 0), 0);
  const stockBadge = totalQty === 0
    ? '<div class="card-stock out">Out of stock</div>'
    : totalQty < 10
      ? '<div class="card-stock low">Only ' + totalQty + ' left!</div>'
      : '<div class="card-stock in">In stock</div>';

  const swatches = colors.length > 1
    ? '<div id="sw-' + a.id + '" class="card-swatches">' +
        colors.map(c =>
          '<span class="csw' + (c === selColor ? ' on' : '') + '" data-color="' + esc(c) + '" ' +
          'onclick="event.stopPropagation();selectCardColor(' + jq(a.id) + ',' + jq(c) + ')" ' +
          'title="' + esc(c) + '" style="background:' + (COLOR_CSS[c] || '#aaa') + '"></span>'
        ).join('') +
      '</div>'
    : '';
  const colorLabel = colors.length
    ? '<div class="card-color-name" id="cn-' + a.id + '">' + esc(selColor) + '</div>'
    : '';

  return '<div class="card prod" onclick="openDetail(' + jq(a.id) + ')">' +
    '<div class="photo-wrap" id="pw-' + a.id + '">' + photoWrapHTML(a) + '</div>' +
    '<div class="prod-info">' +
      '<div class="code">' + esc(a.article_code) + '</div>' +
      '<div class="pname">' + esc(a.name || '') + '</div>' +
      priceHtml +
      stockBadge +
      swatches +
      colorLabel +
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
  if (!SELECTION[aid]) SELECTION[aid] = { color: colors[0] || '', size: null, qty: 1 };
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
  SELECTION[aid].size = null;
  PHOTO_IDX[aid] = 0;
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

function detailHTML(a) {
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const sel = SELECTION[a.id] || {};
  const selColor = sel.color || colors[0] || '';
  const selSize  = sel.size || null;

  const colorPhotos = (a.photos || []).filter(p => p.color === selColor);
  const showPhotos  = colorPhotos.length ? colorPhotos : (a.photos || []);
  const idx = Math.min(PHOTO_IDX[a.id] || 0, Math.max(0, showPhotos.length - 1));

  const bigImg = showPhotos.length
    ? '<img src="' + esc(showPhotos[idx].url) + '" alt="" class="modal-big-img">'
    : '<div class="no-photo" style="height:240px">No photo</div>';

  const dots = showPhotos.length > 1
    ? '<div class="photo-dots" style="bottom:8px">' + showPhotos.map((_, i) =>
        '<span class="photo-dot' + (i === idx ? ' on' : '') + '" onclick="goModalPhoto(' + jq(a.id) + ',' + i + ')"></span>'
      ).join('') + '</div>'
    : '';

  const thumbs = showPhotos.length > 1
    ? '<div class="modal-thumbs">' + showPhotos.map((p, i) =>
        '<img src="' + esc(p.url) + '" class="modal-ptb' + (i === idx ? ' on' : '') + '" onclick="goModalPhoto(' + jq(a.id) + ',' + i + ')" loading="lazy">'
      ).join('') + '</div>'
    : '';

  const swatches = colors.length
    ? '<div class="swatch-section">' +
        '<div class="swatch-label">Colour: <strong>' + esc(selColor) + '</strong></div>' +
        '<div class="swatch-row">' +
          colors.map(c =>
            '<button class="color-swatch' + (c === selColor ? ' on' : '') + '" onclick="selectColor(' + jq(a.id) + ',' + jq(c) + ')" title="' + esc(c) + '" style="background:' + (COLOR_CSS[c] || '#aaa') + '"></button>'
          ).join('') +
        '</div></div>'
    : '';

  const colVars = a.variants.filter(v => v.color === selColor);
  const sizeChips = colVars.length
    ? '<div class="size-chip-row">' +
        '<span class="swatch-label">Size:</span>' +
        colVars.map(v =>
          '<button class="size-chip' + (v.size === selSize ? ' on' : '') + (v.available_qty === 0 ? ' disabled' : '') + '" ' +
          (v.available_qty > 0 ? 'onclick="selectSize(' + jq(a.id) + ',' + jq(v.size) + ')"' : 'disabled') + '>' +
          esc(v.size || '—') + '</button>'
        ).join('') +
      '</div>'
    : '';

  let addSection = '';
  if (selSize) {
    const selVar = colVars.find(v => v.size === selSize);
    if (selVar && selVar.available_qty > 0) {
      const price = selVar.price != null ? selVar.price : a.base_price;
      const inCart = CART[selVar.id] ? CART[selVar.id].qty : 0;
      const qty = sel.qty || 1;
      addSection =
        '<div class="modal-add-section">' +
          '<div class="modal-stock-row">' +
            stockLabel(selVar.available_qty, '12px') +
            (SHOW_PRICES && price != null ? ' <span class="price" style="font-size:15px;margin-left:8px">' + esc(CUR) + price + '/pc</span>' : '') +
          '</div>' +
          (inCart ? '<div style="font-size:12px;color:var(--teal);margin-top:4px">' + inCart + ' already in cart</div>' : '') +
          '<div class="modal-stepper-row">' +
            '<div class="stepper">' +
              '<button onclick="modalChg(' + jq(a.id) + ',-1)">&#8722;</button>' +
              '<input type="number" class="modal-qty-input" min="1" max="' + selVar.available_qty + '" value="' + qty + '" onchange="setModalQty(' + jq(a.id) + ',this.value,' + selVar.available_qty + ')">' +
              '<button onclick="modalChg(' + jq(a.id) + ',1)">+</button>' +
            '</div>' +
            '<button class="btn amber" onclick="addToCart(' + jq(a.id) + ')">Add to Cart</button>' +
          '</div>' +
        '</div>';
    } else if (selVar) {
      addSection = '<div class="modal-add-section"><span style="color:#C0563F;font-weight:700">Out of stock</span></div>';
    }
  } else if (colVars.length) {
    addSection = '<div class="modal-add-section muted" style="font-size:13px">Select a size to add to cart</div>';
  }

  let minPrice = a.base_price;
  a.variants.forEach(v => {
    const p = v.price != null ? v.price : a.base_price;
    if (p != null && (minPrice == null || p < minPrice)) minPrice = p;
  });

  return '<div class="modal-photo-area">' +
      (showPhotos.length > 1 ? '<button class="slide-btn prev" onclick="prevDPhoto(' + jq(a.id) + ')">&#8249;</button>' : '') +
      bigImg +
      (showPhotos.length > 1 ? '<button class="slide-btn next" onclick="nextDPhoto(' + jq(a.id) + ')">&#8250;</button>' : '') +
      dots +
    '</div>' +
    thumbs +
    '<div class="modal-info">' +
      '<div class="modal-title-row">' +
        '<div>' +
          '<span class="code" style="font-size:16px">' + esc(a.article_code) + '</span>' +
          '<span class="pname" style="display:block;font-size:13px;margin-top:2px">' + esc(a.name || '') + '</span>' +
          (SHOW_PRICES && minPrice != null ? '<span class="price" style="font-size:13px">from ' + esc(CUR) + minPrice + '</span>' : '') +
        '</div>' +
        '<span class="tag">' + esc(a.category) + '</span>' +
      '</div>' +
      (a.description ? '<p class="desc-text">' + esc(a.description) + '</p>' : '') +
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
function setF(k, v) { FILTER[k] = v; load(); }

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
