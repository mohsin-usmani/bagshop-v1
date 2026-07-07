const TOKEN = qs("t");
let DATA = null;
let CUR = "Rs.";
let SHOW_PRICES = true;
const FILTER = { category: "", color: "", size: "", q: "" };
const CART = {};
const PHOTO_IDX = {};
let MODAL_AID = null;

async function load() {
  if (!TOKEN) return showExpired();
  const p = new URLSearchParams({ token: TOKEN });
  if (FILTER.category) p.set("category", FILTER.category);
  if (FILTER.color) p.set("color", FILTER.color);
  if (FILTER.size) p.set("size", FILTER.size);
  if (FILTER.q) p.set("q", FILTER.q);
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
  if (!DATA.articles.length) {
    grid.innerHTML = '<p class="muted">No items match. Try clearing filters.</p>';
  } else {
    grid.innerHTML = DATA.articles.map(articleCard).join("");
  }
  renderCart();
}

// ---- photo wrap (shared between card and modal) ----
function photoWrapHTML(a) {
  const photos = a.photos || [];
  const idx = PHOTO_IDX[a.id] || 0;
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
  const vs = a.variants.map((v) => {
    const price = v.price != null ? v.price : a.base_price;
    const priceHtml = SHOW_PRICES && price != null ? '<span class="price">' + esc(CUR) + price + '/pc</span>' : '';
    const inCart = CART[v.id] ? CART[v.id].qty : 0;
    return '<div class="vrow">' +
      '<div class="vmeta"><strong>' + esc(v.color || "") + '</strong>' + (v.size ? ' · ' + esc(v.size) : '') +
      '<br>' + stockLabel(v.available_qty, '11px') + (priceHtml ? ' ' + priceHtml : '') + '</div>' +
      (v.available_qty > 0 ? stepper(v, a, price, inCart) : '<span class="out-label">Out of stock</span>') +
      '</div>';
  }).join('');

  return '<div class="card prod">' +
    '<div class="photo-wrap" id="pw-' + a.id + '" onclick="openDetail(' + jq(a.id) + ')">' +
      photoWrapHTML(a) +
    '</div>' +
    '<div class="prod-info" onclick="openDetail(' + jq(a.id) + ')">' +
      '<div class="code">' + esc(a.article_code) + '</div>' +
      '<div class="pname">' + esc(a.name || '') + '</div>' +
      '<span class="tag">' + esc(a.category) + '</span>' +
    '</div>' +
    '<div class="vlist">' + vs + '</div>' +
    '</div>';
}

// ---- photo navigation on cards ----
function prevPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a || !a.photos.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + a.photos.length) % a.photos.length;
  const el = document.getElementById('pw-' + aid);
  if (el) el.innerHTML = photoWrapHTML(a);
}
function nextPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a || !a.photos.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % a.photos.length;
  const el = document.getElementById('pw-' + aid);
  if (el) el.innerHTML = photoWrapHTML(a);
}
function goPhoto(aid, idx) {
  PHOTO_IDX[aid] = idx;
  const a = DATA.articles.find(x => x.id === aid);
  if (!a) return;
  const el = document.getElementById('pw-' + aid);
  if (el) el.innerHTML = photoWrapHTML(a);
}

// ---- product detail modal ----
function openDetail(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a) return;
  MODAL_AID = aid;
  const modal = document.getElementById('prodModal');
  modal.querySelector('.prod-modal-body').innerHTML = detailHTML(a);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDetail() {
  document.getElementById('prodModal').classList.remove('open');
  document.body.style.overflow = '';
  MODAL_AID = null;
}
function refreshModal() {
  if (!MODAL_AID) return;
  const a = DATA.articles.find(x => x.id === MODAL_AID);
  if (!a) return;
  const body = document.querySelector('#prodModal .prod-modal-body');
  if (body) body.innerHTML = detailHTML(a);
}

function detailHTML(a) {
  const photos = a.photos || [];
  const idx = PHOTO_IDX[a.id] || 0;
  const bigImg = photos.length
    ? '<img src="' + esc(photos[idx].url) + '" alt="" class="modal-big-img">'
    : '<div class="no-photo" style="height:220px">No photo</div>';
  const thumbs = photos.length > 1
    ? '<div class="modal-thumbs">' + photos.map((p, i) =>
        '<img src="' + esc(p.url) + '" class="modal-ptb' + (i === idx ? ' on' : '') + '" onclick="goDPhoto(' + jq(a.id) + ',' + i + ')" loading="lazy">'
      ).join('') + '</div>'
    : '';
  const vs = a.variants.map((v) => {
    const price = v.price != null ? v.price : a.base_price;
    const priceHtml = SHOW_PRICES && price != null ? '<span class="price">' + esc(CUR) + price + '/pc</span>' : '';
    const inCart = CART[v.id] ? CART[v.id].qty : 0;
    return '<div class="vrow">' +
      '<div class="vmeta"><strong>' + esc(v.color || "—") + '</strong>' + (v.size ? ' · ' + esc(v.size) : '') +
      '<br>' + stockLabel(v.available_qty, '12px') + (priceHtml ? ' ' + priceHtml : '') + '</div>' +
      (v.available_qty > 0 ? stepper(v, a, price, inCart) : '<span class="out-label">Out of stock</span>') +
      '</div>';
  }).join('');

  return '<div class="modal-photo-area">' +
      (photos.length > 1 ? '<button class="slide-btn prev" onclick="prevDPhoto(' + jq(a.id) + ')">&#8249;</button>' : '') +
      bigImg +
      (photos.length > 1 ? '<button class="slide-btn next" onclick="nextDPhoto(' + jq(a.id) + ')">&#8250;</button>' : '') +
    '</div>' +
    thumbs +
    '<div class="modal-info">' +
      '<div class="code" style="font-size:18px">' + esc(a.article_code) + '</div>' +
      '<div style="font-size:14px;color:var(--muted);margin:4px 0 6px">' + esc(a.name || '') + '</div>' +
      '<span class="tag">' + esc(a.category) + '</span>' +
      (a.description ? '<p style="font-size:14px;color:var(--muted);margin:10px 0 0">' + esc(a.description) + '</p>' : '') +
      '<div class="vlist" style="margin-top:14px">' + vs + '</div>' +
    '</div>';
}

function prevDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + a.photos.length) % a.photos.length;
  refreshModal();
}
function nextDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % a.photos.length;
  refreshModal();
}
function goDPhoto(aid, idx) {
  PHOTO_IDX[aid] = idx;
  refreshModal();
}

// ---- filters ----
function setF(k, val) { FILTER[k] = val; load(); }

// ---- stepper (±1, capped at stock) ----
function stepper(v, a, price, qty) {
  const label = a.article_code + (v.color ? " " + v.color : "") + (v.size ? " " + v.size : "");
  const p = price != null ? price : 0;
  return '<div class="stepper" data-v="' + v.id + '">' +
    '<button onclick="chg(' + jq(v.id) + ',' + jq(label) + ',' + p + ',-1,' + v.available_qty + ')">&#8722;</button>' +
    '<input type="number" min="0" max="' + v.available_qty + '" value="' + qty + '" ' +
      'onchange="setQty(' + jq(v.id) + ',' + jq(label) + ',' + p + ',this.value,' + v.available_qty + ')">' +
    '<button onclick="chg(' + jq(v.id) + ',' + jq(label) + ',' + p + ',1,' + v.available_qty + ')">+</button></div>';
}

function chg(id, label, price, delta, max) {
  const cur = CART[id] ? CART[id].qty : 0;
  setQty(id, label, price, cur + delta, max);
}
function setQty(id, label, price, val, max) {
  let q = parseInt(val) || 0;
  if (q < 0) q = 0;
  if (max != null && q > max) { q = max; toast("Only " + max + " in stock"); }
  if (q === 0) delete CART[id];
  else CART[id] = { qty: q, label, price };
  document.querySelectorAll('.stepper[data-v="' + id + '"] input').forEach(box => { box.value = q; });
  renderCart();
  // update cart badge on the card
  if (DATA) {
    const a = DATA.articles.find(x => x.variants.some(v => v.id === id));
    if (a) { const el = document.getElementById('pw-' + a.id); if (el) el.innerHTML = photoWrapHTML(a); }
  }
}

// ---- cart ----
function renderCart() {
  const ids = Object.keys(CART);
  const count = ids.reduce((n, id) => n + CART[id].qty, 0);
  const bar = document.getElementById("cartbar");
  bar.style.display = ids.length ? "block" : "none";
  document.getElementById("cartCount").textContent = count;
  const lines = document.getElementById("cartLines");
  let total = 0;
  lines.innerHTML = ids.map((id) => {
    const c = CART[id];
    total += (c.price || 0) * c.qty;
    return '<div class="line"><div>' + esc(c.label) + ' <span class="muted">&#215; ' + c.qty + '</span></div>' +
      (SHOW_PRICES ? '<div class="muted">' + esc(CUR) + (c.price * c.qty) + '</div>' : '') +
      '<span class="x" onclick="removeItem(' + jq(id) + ')">&#10005;</span></div>';
  }).join("") || '<p class="muted">Cart is empty.</p>';
  document.getElementById("cartTotal").innerHTML = SHOW_PRICES && ids.length ? 'Indicative total: ' + esc(CUR) + total : '';
}
function removeItem(id) { delete CART[id]; render(); if (MODAL_AID) refreshModal(); }

function openCart() { document.getElementById("drawer").classList.add("open"); }
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

function stockLabel(qty, size) {
  if (qty < 10) return '<span style="font-size:' + size + ';color:#C0563F;font-weight:700">Only ' + qty + ' left!</span>';
  return '<span style="font-size:' + size + ';color:#0E6B57;font-weight:600">In stock</span>';
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function jq(s) { return "'" + String(s).replace(/'/g, "\\'") + "'"; }

load();
