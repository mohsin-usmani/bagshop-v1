// ── Product Detail Page ──
const TOKEN = qs('t');
const PRODUCT_ID = qs('id');
let DATA = null;
let ARTICLE = null;
let CUR = 'Rs.';
let SHOW_PRICES = true;
let SEL = { color: '', size: null, qty: 1 };
let PHOTO_IDX = 0;
const CART = {};

const COLOR_CSS = {
  'Black':'#1C1C1C','Brown':'#7B4B2A','Red':'#CC2200','Beige':'#D4B896',
  'Navy':'#1B2A6B','Cream':'#F0E6CC','Green':'#2E7D32','Pink':'#E91E63',
  'White':'#EBEBEB','Grey':'#757575','Blue':'#1565C0','Olive':'#6D7B2C',
  'Tan':'#C8965C','Burgundy':'#7B1A2A','Gold':'#C9962E','Purple':'#6A1B9A',
  'Silver':'#C0C0C0','Black/Grey':'#3D3D3D','Deep Black':'#0A0A0A',
  'Midnight Blue':'#0D1B4B','Navy Blue':'#1B2A6B','Dark Navy':'#0D1426',
  'Brushed Silver':'#B8BCC0','Ivory Gold':'#D4C070','Stormy Weather':'#6B7280',
  'Brushed Black':'#2A2A2A','Grey Blue':'#5B7FA6','Mocha':'#7C5C45',
  'Bright Lime':'#9ACD32','Dusty Pink':'#D4A0A0','Blush':'#FFB6C1',
  'Nude':'#E8C9A0','Camel':'#C19A6B','Teal':'#008080','Coral':'#FF6B6B',
  'Orange':'#FF8C00','Yellow':'#FFD700','Natural':'#D4C5A9',
};

const PLACEHOLDER_MAP = [
  ['trekking','photo-1501555088652-021faa106b9b'],['trek','photo-1501555088652-021faa106b9b'],
  ['luggage','photo-1553482085-9cbe3a9b8008'],['trolley','photo-1562157873-818bc0726f68'],
  ['suitcase','photo-1594035910387-fea47794261f'],['laptop','photo-1622560480605-d83c853bc5c3'],
  ['backpack','photo-1553062407-98eeb64c6a62'],['back pack','photo-1553062407-98eeb64c6a62'],
  ['sling','photo-1614179818511-68c10c1bbca5'],['crossbody','photo-1614179818511-68c10c1bbca5'],
  ['wallet','photo-1627123424574-724758594785'],['ladies','photo-1548036328-c9fa89d128fa'],
  ['tote','photo-1584917865442-de89df76afd3'],['gym','photo-1544966503-7cc5ac882d5f'],
  ['duffel','photo-1544966503-7cc5ac882d5f'],['handbag','photo-1548036328-c9fa89d128fa'],
];

function getPlaceholder(a) {
  const text = ((a.name || '') + ' ' + (a.category || '')).toLowerCase();
  for (const [k, id] of PLACEHOLDER_MAP) {
    if (text.includes(k)) return 'https://images.unsplash.com/' + id + '?w=800&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80';
}

function resolvePhotos(color) {
  if (!ARTICLE) return [];
  const all = ARTICLE.photos || [];
  const forColor = color ? all.filter(p => p.color === color) : all;
  if (forColor.length) return forColor;
  if (all.length) return all;
  return [{ url: getPlaceholder(ARTICLE), _placeholder: true }];
}

// ── Cart persistence ──
function saveCart() {
  try { localStorage.setItem('bag_cart_' + TOKEN, JSON.stringify(CART)); } catch(e) {}
}
function loadCart() {
  try {
    const raw = localStorage.getItem('bag_cart_' + TOKEN);
    if (raw) { const c = JSON.parse(raw); Object.assign(CART, c); }
  } catch(e) {}
}

// ── Init ──
async function init() {
  if (!TOKEN || !PRODUCT_ID) return showError('Missing product or token.');
  const { ok, status, data } = await api('/api/catalog?token=' + encodeURIComponent(TOKEN));
  if (status === 403) return showExpired();
  if (!ok || !data) return showError('Could not load product.');

  DATA = data;
  CUR = data.shop.currency || 'Rs.';
  SHOW_PRICES = !!data.shop.show_prices;
  document.getElementById('navShopName').textContent = data.shop.name || '';
  applyBranding(data.shop);

  ARTICLE = data.articles.find(a => String(a.id) === String(PRODUCT_ID));
  if (!ARTICLE) return showError('Product not found.');

  loadCart();

  // Default color/size
  const colors = [...new Set(ARTICLE.variants.map(v => v.color).filter(Boolean))];
  SEL.color = colors[0] || '';
  const colVars = ARTICLE.variants.filter(v => v.color === SEL.color && v.available_qty > 0);
  if (colVars.length === 1) SEL.size = colVars[0].size;

  renderNav();
  renderBreadcrumb();
  renderPDP();
  renderCart();
}

function showExpired() {
  document.getElementById('pdpApp').innerHTML =
    '<div class="notice card"><h2>Link expired</h2><p class="muted" style="margin-top:8px">Please get a fresh catalogue link.</p></div>';
}
function showError(msg) {
  document.getElementById('pdpApp').innerHTML = '<div class="notice"><p class="muted">' + esc(msg) + '</p></div>';
}

// ── Navbar ──
function renderNav() {
  // Same admin-controlled header menu (max 10) as the catalogue.
  const cats = DATA
    ? ((DATA.nav_categories && DATA.nav_categories.length ? DATA.nav_categories : (DATA.filters.categories || [])).slice(0, 10))
    : [];
  const bar = document.getElementById('navCatsBar');
  if (bar) {
    bar.innerHTML =
      '<button class="nav-cat-link" onclick="goBack()">← Back</button>' +
      cats.map(c =>
        '<button class="nav-cat-link" onclick="goCatalogCat(\'' + jq(c) + '\')">' + esc(c) + '</button>'
      ).join('') +
      '<button class="nav-cat-link" onclick="goCatalogCat(\'\')">Shop All</button>';
  }
  const total = Object.values(CART).reduce((n, c) => n + c.qty, 0);
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = total; badge.style.display = total ? 'flex' : 'none'; }
}

function goCatalogCat(cat) {
  const base = '/s.html?t=' + encodeURIComponent(TOKEN);
  window.location.href = base + (cat ? '&cat=' + encodeURIComponent(cat) : '');
}

// Logo → catalogue home. Always an explicit navigation (never history.back),
// so it works even when this product page is the first entry in history
// (e.g. link opened directly inside WhatsApp's in-app browser).
function goHome() { goCatalogCat(''); }

// Back arrow / breadcrumb → prefer a real back step so the customer keeps their
// place in the listing, but fall back to the catalogue home when there is no
// same-site history to go back to (otherwise the button would do nothing).
function goBack() {
  const ref = document.referrer || '';
  const cameFromCatalogue = ref.indexOf(location.origin) === 0 && ref.indexOf('/s.html') !== -1;
  if (cameFromCatalogue && window.history.length > 1) history.back();
  else goHome();
}

function renderBreadcrumb() {
  const el = document.getElementById('pdpBreadcrumb');
  if (!el || !ARTICLE) return;
  el.innerHTML =
    '<span onclick="goBack()" style="cursor:pointer;color:var(--brand)">← Catalogue</span>' +
    '<span class="bc-sep"> / </span>' +
    (ARTICLE.category ? '<span onclick="goCatalogCat(\'' + jq(ARTICLE.category) + '\')" style="cursor:pointer">' + esc(ARTICLE.category) + '</span><span class="bc-sep"> / </span>' : '') +
    '<span style="color:var(--muted)">' + esc(ARTICLE.name || ARTICLE.article_code) + '</span>';
}

// ── Render PDP ──
function renderPDP() {
  document.title = (ARTICLE.name || ARTICLE.article_code) + ' — FinEx';
  document.getElementById('pdpApp').innerHTML = pdpHTML();
  document.getElementById('pdpApp').style.paddingBottom = '80px';
}

function pdpHTML() {
  const a = ARTICLE;
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const colVars = a.variants.filter(v => v.color === SEL.color);
  const photos = resolvePhotos(SEL.color);
  const idx = Math.min(PHOTO_IDX, Math.max(0, photos.length - 1));

  // Price
  let displayPrice = null;
  if (SEL.size) {
    const sv = colVars.find(v => v.size === SEL.size);
    if (sv) displayPrice = sv.price ?? a.base_price;
  }
  if (displayPrice == null) colVars.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (displayPrice == null || p < displayPrice)) displayPrice = p; });
  if (displayPrice == null) a.variants.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (displayPrice == null || p < displayPrice)) displayPrice = p; });

  // Stock
  const totalAvail = colVars.reduce((n, v) => n + (v.available_qty || 0), 0);
  const inStock = totalAvail > 0;

  // Gallery HTML
  const mainImg = photos.length
    ? '<img class="pdp-main-img" id="pdpMainImg" src="' + esc(photos[idx].url) + '" alt="' + esc(a.name || '') + '" onclick="openLightbox(' + idx + ')">'
    : '<div class="no-photo" style="height:100%">No photo</div>';

  const thumbsHTML = photos.length > 1
    ? '<div class="pdp-thumbs">' +
        photos.map((p, i) =>
          '<img class="pdp-thumb' + (i === idx ? ' on' : '') + '" src="' + esc(p.url) + '" loading="lazy" onclick="goPhoto(' + i + ')">'
        ).join('') +
      '</div>'
    : '';

  const arrowsHTML = photos.length > 1
    ? '<button class="pdp-arr prev" onclick="prevPhoto()">&#8249;</button>' +
      '<button class="pdp-arr next" onclick="nextPhoto()">&#8250;</button>'
    : '';

  // Colour selector — shows a photo of each colour (Flipkart/Amazon style),
  // falling back to a colour block only when that colour has no tagged photo.
  let colourSection = '';
  if (colors.length > 0) {
    colourSection =
      '<div class="pdp-col-label">Colour: <strong>' + esc(SEL.color) + '</strong></div>' +
      '<div class="pdp-swatches">' +
        colors.map(c => {
          const cphoto = (a.photos || []).find(p => p.color === c);
          const inner = cphoto
            ? '<img src="' + esc(cphoto.url) + '" alt="' + esc(c) + '" loading="lazy">'
            : '<span class="pdp-swatch-color" style="background:' + (COLOR_CSS[c] || '#ccc') + '"></span>';
          return '<button class="pdp-swatch-btn' + (c === SEL.color ? ' on' : '') + '"' +
            ' onclick="selectColor(\'' + jq(c) + '\')" title="' + esc(c) + '">' + inner +
            '<span class="pdp-swatch-name">' + esc(c) + '</span>' +
          '</button>';
        }).join('') +
      '</div>';
  }

  // Size chips
  const hasSizes = colVars.some(v => v.size && v.size.trim());
  let sizeSection = '';
  if (hasSizes) {
    sizeSection =
      '<div class="pdp-size-label">Size' + (SEL.size ? ': <strong>' + esc(SEL.size) + '</strong>' : '') + '</div>' +
      '<div class="pdp-sizes">' +
        colVars.map(v => {
          const avail = v.available_qty || 0;
          const sub = avail === 0 ? 'Sold out' : avail < 10 ? 'Only ' + avail + ' left' : 'In stock';
          return '<button class="pdp-size-chip' + (v.size === SEL.size ? ' on' : '') + '"' +
            (avail === 0 ? ' disabled' : ' onclick="selectSize(\'' + jq(v.size) + '\')"') + '>' +
            '<span class="pdp-size-name">' + esc(v.size || '—') + '</span>' +
            '<span class="pdp-size-sub">' + sub + '</span>' +
          '</button>';
        }).join('') +
      '</div>';
  }

  // Add to cart
  const canAdd = SEL.size || !hasSizes;
  let atcSection = '';
  if (canAdd) {
    const sv = hasSizes
      ? colVars.find(v => v.size === SEL.size)
      : colVars.find(v => v.available_qty > 0) || colVars[0];
    if (sv && sv.available_qty > 0) {
      const svPrice = sv.price ?? a.base_price;
      const qty = SEL.qty || 1;
      const inCart = CART[sv.id] ? CART[sv.id].qty : 0;
      atcSection =
        '<div class="pdp-divider"></div>' +
        '<div class="pdp-qty-row">' +
          '<span class="pdp-qty-label">Qty</span>' +
          '<div class="stepper">' +
            '<button onclick="changeQty(-1)">−</button>' +
            '<input type="number" id="pdpQtyInput" min="1" max="' + sv.available_qty + '" value="' + qty + '" onchange="setQty(this.value,' + sv.available_qty + ')">' +
            '<button onclick="changeQty(1)">+</button>' +
          '</div>' +
        '</div>' +
        '<button class="pdp-atc" onclick="addToCart()">' +
          'ADD TO CART' +
          (SHOW_PRICES && svPrice != null ? ' — ' + esc(CUR) + ' ' + (svPrice * qty) : '') +
        '</button>' +
        (inCart ? '<div class="pdp-in-cart">✓ ' + inCart + ' pc already in your cart</div>' : '');
    } else if (sv) {
      atcSection = '<div style="padding:14px 0;color:var(--danger);font-weight:700">Out of stock</div>';
    }
  } else {
    atcSection = '<div style="padding:14px 0;color:var(--muted);font-size:13px">← Select a size to continue</div>';
  }

  return '<div class="pdp-page">' +
    '<div class="pdp-layout">' +
      // Gallery side
      '<div class="pdp-gallery">' +
        '<div class="pdp-main-wrap" id="pdpMainWrap">' +
          arrowsHTML + mainImg +
        '</div>' +
        thumbsHTML +
      '</div>' +
      // Info side
      '<div class="pdp-info">' +
        '<div class="pdp-brand-tag">' + esc(DATA.shop.name || '') + '</div>' +
        '<h1 class="pdp-title">' + esc(a.name || '') + '</h1>' +
        '<div class="pdp-sub">' + esc(a.article_code) + (a.category ? ' · ' + esc(a.category) : '') + '</div>' +
        '<div class="pdp-stock-row">' +
          '<div class="pdp-stock-dot' + (inStock ? '' : ' out') + '"></div>' +
          '<span class="pdp-stock-text' + (inStock ? '' : ' out') + '">' + (inStock ? 'In Stock' : 'Out of Stock') + '</span>' +
        '</div>' +
        (SHOW_PRICES && displayPrice != null
          ? '<div class="pdp-price-label">Price (per piece · wholesale)</div>' +
            '<div class="pdp-price">' + esc(CUR) + ' ' + displayPrice + '</div>'
          : '') +
        (a.description ? '<p class="pdp-desc">' + esc(a.description) + '</p>' : '') +
        '<div class="pdp-divider"></div>' +
        colourSection +
        sizeSection +
        atcSection +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Photo navigation ──
function goPhoto(i) {
  const photos = resolvePhotos(SEL.color);
  PHOTO_IDX = Math.max(0, Math.min(i, photos.length - 1));
  const img = document.getElementById('pdpMainImg');
  if (img) img.src = photos[PHOTO_IDX].url;
  document.querySelectorAll('.pdp-thumb').forEach((t, j) => t.classList.toggle('on', j === PHOTO_IDX));
}
function prevPhoto() {
  const photos = resolvePhotos(SEL.color);
  goPhoto((PHOTO_IDX - 1 + photos.length) % photos.length);
}
function nextPhoto() {
  const photos = resolvePhotos(SEL.color);
  goPhoto((PHOTO_IDX + 1) % photos.length);
}

// ── Selections ──
function selectColor(color) {
  SEL.color = color;
  PHOTO_IDX = 0;
  const avail = ARTICLE.variants.filter(v => v.color === color && v.available_qty > 0);
  SEL.size = avail.length === 1 ? avail[0].size : null;
  SEL.qty = 1;
  renderPDP();
}
function selectSize(size) {
  SEL.size = size;
  SEL.qty = 1;
  renderPDP();
}
function changeQty(delta) {
  const inp = document.getElementById('pdpQtyInput');
  if (!inp) return;
  const max = parseInt(inp.max) || 9999;
  setQty((SEL.qty || 1) + delta, max);
}
function setQty(val, max) {
  let q = parseInt(val) || 1;
  if (q < 1) q = 1;
  if (max != null && q > max) { q = max; toast('Only ' + max + ' in stock'); }
  SEL.qty = q;
  const inp = document.getElementById('pdpQtyInput');
  if (inp) inp.value = q;
  // Update ATC button label
  const btn = document.querySelector('.pdp-atc');
  if (btn && SHOW_PRICES) {
    const colVars = ARTICLE.variants.filter(v => v.color === SEL.color);
    const hasSizes = colVars.some(v => v.size && v.size.trim());
    const sv = hasSizes ? colVars.find(v => v.size === SEL.size) : colVars.find(v => v.available_qty > 0) || colVars[0];
    if (sv) {
      const p = sv.price ?? ARTICLE.base_price;
      if (p != null) btn.textContent = 'ADD TO CART — ' + CUR + ' ' + (p * q);
    }
  }
}

// ── Add to cart ──
function addToCart() {
  const a = ARTICLE;
  const colVars = a.variants.filter(v => v.color === SEL.color);
  const hasSizes = colVars.some(v => v.size && v.size.trim());
  if (!SEL.color) return toast('Please select a colour');
  if (hasSizes && !SEL.size) return toast('Please select a size');
  const v = hasSizes
    ? a.variants.find(v => v.color === SEL.color && v.size === SEL.size)
    : colVars.find(v => v.available_qty > 0) || colVars[0];
  if (!v || v.available_qty <= 0) return toast('Out of stock');
  const qty = SEL.qty || 1;
  const price = v.price != null ? v.price : a.base_price;
  const label = a.article_code + ' ' + SEL.color + (v.size ? ' ' + v.size : '');
  if (CART[v.id]) CART[v.id].qty = Math.min(CART[v.id].qty + qty, v.available_qty);
  else CART[v.id] = { qty, label, price };
  SEL.qty = 1;
  saveCart();
  toast('Added to cart ✓');
  renderCart();
  renderPDP();
}

// ── Cart ──
function renderCart() {
  const ids = Object.keys(CART);
  const count = ids.reduce((n, id) => n + CART[id].qty, 0);
  document.getElementById('cartbar').style.display = ids.length ? 'block' : 'none';
  document.getElementById('cartCount').textContent = count;
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
  let total = 0;
  document.getElementById('cartLines').innerHTML = ids.map(id => {
    const c = CART[id]; total += (c.price || 0) * c.qty;
    return '<div class="line"><div style="flex:1">' + esc(c.label) + ' <span class="muted">× ' + c.qty + '</span></div>' +
      (SHOW_PRICES ? '<div class="muted">' + esc(CUR) + (c.price * c.qty) + '</div>' : '') +
      '<span class="x" onclick="removeItem(\'' + jq(id) + '\')">✕</span></div>';
  }).join('') || '<p class="muted">Cart is empty.</p>';
  document.getElementById('cartTotal').innerHTML = SHOW_PRICES && ids.length ? 'Est. total: <strong>' + esc(CUR) + total + '</strong>' : '';
}
function removeItem(id) {
  delete CART[id]; saveCart(); renderCart(); renderPDP();
}
function openCart()  { document.getElementById('drawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeCart() { document.getElementById('drawer').classList.remove('open'); document.body.style.overflow = ''; }

async function sendOrder() {
  const items = Object.keys(CART).map(id => ({ variant_id: id, qty: CART[id].qty }));
  if (!items.length) return toast('Cart is empty');
  const { ok, status, data } = await api('/api/order', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, items }),
  });
  if (status === 403) return showExpired();
  if (ok && data && data.whatsapp) window.location.href = data.whatsapp;
  else toast('Could not send. Please try again.');
}

// ── Touch swipe ──
(function() {
  let sx = 0;
  document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const wrap = e.target.closest('.pdp-main-wrap');
    if (!wrap) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) { if (dx < 0) nextPhoto(); else prevPhoto(); }
  }, { passive: true });
})();

// ── Fullscreen pinch-to-zoom lightbox ──
const LB = { idx: 0, scale: 1, x: 0, y: 0, pointers: new Map(), startDist: 0, startScale: 1, startMid: null, panStart: null, lastTapTime: 0, lastTapX: 0 };
const MAX_SCALE = 4;

function lbPhotos() { return resolvePhotos(SEL.color); }

function openLightbox(i) {
  const photos = lbPhotos();
  if (!photos.length) return;
  LB.idx = Math.max(0, Math.min(i, photos.length - 1));
  resetLbTransform();
  document.getElementById('pdpLightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderLbImage();
}
function closeLightbox() {
  document.getElementById('pdpLightbox').classList.remove('open');
  document.body.style.overflow = '';
  LB.pointers.clear();
}
function renderLbImage() {
  const photos = lbPhotos();
  const img = document.getElementById('pdpLbImg');
  img.src = photos[LB.idx].url;
  const counter = document.getElementById('pdpLbCounter');
  counter.textContent = photos.length > 1 ? (LB.idx + 1) + ' / ' + photos.length : '';
  const prevBtn = document.getElementById('pdpLbPrev'), nextBtn = document.getElementById('pdpLbNext');
  const show = photos.length > 1 ? 'flex' : 'none';
  prevBtn.style.display = show; nextBtn.style.display = show;
}
function resetLbTransform() {
  LB.scale = 1; LB.x = 0; LB.y = 0;
  applyLbTransform();
}
function applyLbTransform() {
  const img = document.getElementById('pdpLbImg');
  if (img) img.style.transform = 'translate(' + LB.x + 'px,' + LB.y + 'px) scale(' + LB.scale + ')';
}
function lbPrev() {
  if (LB.scale > 1.01) return;
  const photos = lbPhotos();
  LB.idx = (LB.idx - 1 + photos.length) % photos.length;
  resetLbTransform(); renderLbImage();
}
function lbNext() {
  if (LB.scale > 1.01) return;
  const photos = lbPhotos();
  LB.idx = (LB.idx + 1) % photos.length;
  resetLbTransform(); renderLbImage();
}

function lbDist(pts) {
  const [a, b] = pts;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function lbMid(pts) {
  const [a, b] = pts;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

(function() {
  const stage = () => document.getElementById('pdpLbStage');

  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#pdpLbStage')) return;
    LB.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (LB.pointers.size === 2) {
      const pts = [...LB.pointers.values()];
      LB.startDist = lbDist(pts);
      LB.startScale = LB.scale;
      LB.startMid = lbMid(pts);
    } else if (LB.pointers.size === 1) {
      LB.panStart = { x: e.clientX, y: e.clientY, lx: LB.x, ly: LB.y };
    }
  });

  document.addEventListener('pointermove', e => {
    if (!LB.pointers.has(e.pointerId)) return;
    LB.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (LB.pointers.size === 2) {
      const pts = [...LB.pointers.values()];
      const dist = lbDist(pts);
      const factor = dist / (LB.startDist || dist);
      LB.scale = Math.max(1, Math.min(MAX_SCALE, LB.startScale * factor));
      applyLbTransform();
    } else if (LB.pointers.size === 1 && LB.scale > 1.01 && LB.panStart) {
      LB.x = LB.panStart.lx + (e.clientX - LB.panStart.x);
      LB.y = LB.panStart.ly + (e.clientY - LB.panStart.y);
      applyLbTransform();
    }
  });

  function endPointer(e) {
    const wasSingle = LB.pointers.size === 1;
    const pt = LB.pointers.get(e.pointerId);
    LB.pointers.delete(e.pointerId);
    if (LB.scale < 1.05) { LB.scale = 1; LB.x = 0; LB.y = 0; applyLbTransform(); }
    if (wasSingle && LB.scale <= 1.01 && pt && LB.panStart) {
      const dx = e.clientX - LB.panStart.x;
      if (Math.abs(dx) > 50) { if (dx < 0) lbNext(); else lbPrev(); }
    }
    if (LB.pointers.size === 0) {
      const now = Date.now();
      if (now - LB.lastTapTime < 300 && Math.abs(e.clientX - LB.lastTapX) < 30) {
        LB.scale = LB.scale > 1.01 ? 1 : 2.5;
        LB.x = 0; LB.y = 0;
        applyLbTransform();
        LB.lastTapTime = 0;
      } else {
        LB.lastTapTime = now;
        LB.lastTapX = e.clientX;
      }
      LB.panStart = null;
    }
  }
  document.addEventListener('pointerup', e => { if (e.target.closest('#pdpLbStage') || LB.pointers.has(e.pointerId)) endPointer(e); });
  document.addEventListener('pointercancel', e => { if (LB.pointers.has(e.pointerId)) endPointer(e); });

  document.addEventListener('wheel', e => {
    if (!e.target.closest('#pdpLbStage')) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    LB.scale = Math.max(1, Math.min(MAX_SCALE, LB.scale + delta));
    if (LB.scale <= 1.01) { LB.scale = 1; LB.x = 0; LB.y = 0; }
    applyLbTransform();
  }, { passive: false });

  document.getElementById('pdpLightbox').addEventListener('click', e => {
    if ((e.target.id === 'pdpLightbox' || e.target.id === 'pdpLbStage') && LB.scale <= 1.01) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('pdpLightbox').classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lbPrev();
    if (e.key === 'ArrowRight') lbNext();
  });
})();

// ── Utils ──
function jq(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// ── Start ──
init();
