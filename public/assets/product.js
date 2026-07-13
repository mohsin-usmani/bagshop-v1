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
    Object.keys(CART).forEach(k => delete CART[k]); // full resync, not merge — see pageshow handler below
    if (raw) Object.assign(CART, JSON.parse(raw));
  } catch(e) {}
}
// Mobile back gestures/buttons (goBack() uses history.back()) often restore
// the page from the browser's back-forward cache (bfcache) instead of
// reloading it — init() never re-runs, so a cart change made on another page
// never shows up here unless we explicitly resync from storage.
window.addEventListener('pageshow', e => {
  if (!e.persisted || !ARTICLE) return;
  loadCart();
  renderNav();
  renderCart();
});

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
  renderExtras();
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
  const catButtons = cats.map(c =>
    '<button class="nav-cat-link" onclick="goCatalogCat(\'' + jq(c) + '\')">' + esc(c) + '</button>'
  ).join('') + '<button class="nav-cat-link" onclick="goCatalogCat(\'\')">Shop All</button>';

  // Mobile/narrow bar keeps an explicit "← Back" link (no separate back
  // button there); the single-row desktop header relies on the logo for
  // home and doesn't need one.
  const bar = document.getElementById('navCatsBar');
  if (bar) bar.innerHTML = '<button class="nav-cat-link" onclick="goBack()">← Back</button>' + catButtons;
  const barD = document.getElementById('navdCatsBar');
  if (barD) barD.innerHTML = catButtons;

  const navdShopName = document.getElementById('navdShopName');
  if (navdShopName && DATA) navdShopName.textContent = DATA.shop.name || '';

  const total = Object.values(CART).reduce((n, c) => n + c.qty, 0);
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = total; badge.style.display = total ? 'flex' : 'none'; }
  const badgeD = document.getElementById('navdCartBadge');
  if (badgeD) { badgeD.textContent = total; badgeD.style.display = total ? 'flex' : 'none'; }
}

function goCatalogCat(cat) {
  const base = '/s.html?t=' + encodeURIComponent(TOKEN);
  window.location.href = base + (cat ? '&cat=' + encodeURIComponent(cat) : '');
}

// There's no product grid on this page to filter — searching from here hands
// the query off to the catalogue page (via localStorage, picked up by its
// init()) and navigates there, same as tapping a category would.
function onSearchKey(e, val) {
  if (e.key !== 'Enter') return;
  const q = (val || '').trim();
  if (!q) return;
  try { localStorage.setItem('bag_pending_search', q); } catch (err) {}
  goCatalogCat('');
}

// ── Order history (mirrors the catalogue page's drawer) ──
async function openHistory() {
  const d = document.getElementById('historyDrawer');
  d.classList.add('open'); document.body.style.overflow = 'hidden';
  const body = document.getElementById('historyBody');
  body.innerHTML = '<p class="muted" style="padding:12px">Loading your orders…</p>';
  const { ok, status, data } = await api('/api/history?token=' + encodeURIComponent(TOKEN));
  if (status === 403) { body.innerHTML = '<p class="muted" style="padding:12px">This link has expired.</p>'; return; }
  if (!ok || !data) { body.innerHTML = '<p class="muted" style="padding:12px">Could not load your orders. Please try again.</p>'; return; }
  renderHistory(data.orders || []);
}
function closeHistory() { document.getElementById('historyDrawer').classList.remove('open'); document.body.style.overflow = ''; }
function renderHistory(orders) {
  const body = document.getElementById('historyBody');
  if (!orders.length) {
    body.innerHTML = '<p class="muted" style="padding:16px 12px">No past orders yet. Anything you order will show up here next time.</p>';
    return;
  }
  body.innerHTML = orders.map(o => {
    const dt = new Date(o.created_at);
    const dateStr = isNaN(dt) ? '' : dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const lines = (o.items || []).map(it => {
      const bits = [esc(it.name || it.article_code || 'Item')];
      if (it.color) bits.push(esc(it.color));
      if (it.size) bits.push(esc(it.size));
      return '<div class="hist-line"><span>' + bits.join(' · ') + '</span><span class="muted">×' + (it.qty || 1) + '</span></div>';
    }).join('');
    const totalStr = (SHOW_PRICES && o.est_total) ? '<span class="hist-total">' + esc(CUR) + ' ' + o.est_total + '</span>' : '';
    return '<div class="hist-order">' +
      '<div class="hist-head"><strong>' + dateStr + '</strong>' + totalStr + '</div>' +
      lines +
    '</div>';
  }).join('');
}

// Logo → catalogue home. Always an explicit navigation (never history.back),
// so it works even when this product page is the first entry in history
// (e.g. link opened directly inside WhatsApp's in-app browser).
function goHome() { goCatalogCat(''); }

// Back arrow / breadcrumb → prefer a real back step so the customer returns to
// where they came from — the catalogue listing OR the previous product (when they
// arrived here via "You may also like" / "Similar products"). Falls back to the
// catalogue home only when there's no same-site history to go back to.
function goBack() {
  const ref = document.referrer || '';
  const sameSite = ref.indexOf(location.origin) === 0 &&
    (ref.indexOf('/s.html') !== -1 || ref.indexOf('/s?') !== -1 || ref.indexOf('/product') !== -1);
  if (sameSite && window.history.length > 1) history.back();
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
  document.getElementById('pdpApp').style.paddingBottom = '24px';
  Z.scale = 1; Z.x = 0; Z.y = 0; // fresh gallery markup is already unzoomed — keep state in sync
  // The old (possibly fullscreen-zoomed) wrap was just replaced, so its zoom
  // popup is gone too — release the scroll lock unless the cart drawer (which
  // also locks scroll) is the one holding it open.
  const drawer = document.getElementById('drawer');
  if (!drawer || !drawer.classList.contains('open')) document.body.style.overflow = '';
}

// ── Below the product: "You may also like" + "Similar products" ──
// Rendered once (separate from pdpApp) so switching colour doesn't reset them.
function renderExtras() {
  const el = document.getElementById('pdpExtras');
  if (!el) return;
  el.innerHTML = (ARTICLE && DATA) ? (youMayLikeHTML() + similarProductsHTML()) : '';
}
function articleMinPrice(a) {
  let mp = null;
  (a.variants || []).forEach(v => { const p = v.price != null ? v.price : a.base_price; if (p != null && (mp == null || p < mp)) mp = p; });
  return mp != null ? mp : a.base_price;
}
function recCard(a) {
  const img = cartPhotoFor(a, null);
  const mp = articleMinPrice(a);
  // rec-desc is always rendered (even empty) so every card in a row reserves
  // the same content height — some mobile browsers don't reliably stretch
  // flex children in a horizontally-scrolling row, so the ATC button would
  // otherwise land at a different height on cards missing a description.
  return '<div class="rec-card" onclick="openProductNav(\'' + jq(a.id) + '\')">' +
    '<div class="rec-img"><img src="' + esc(img) + '" alt="" loading="lazy"></div>' +
    '<div class="rec-body">' +
      '<div class="rec-name">' + esc(a.name || a.article_code) + '</div>' +
      '<div class="rec-desc">' + esc(a.description || '') + '</div>' +
      (SHOW_PRICES && mp != null ? '<div class="rec-price">' + esc(CUR) + ' ' + mp + '/pc</div>' : '') +
    '</div>' +
    '<button class="btn-atc" onclick="event.stopPropagation();quickAddRec(\'' + jq(a.id) + '\')">ADD TO CART</button>' +
  '</div>';
}

// Quick-add from "You may also like" / "Similar products" cards — adds the
// first colour/size variant straight to the cart without opening the product
// page, so the customer never leaves the page they're on.
function quickAddRec(aid) {
  const a = DATA.articles.find(x => String(x.id) === String(aid));
  if (!a) return;
  const color = ((a.variants || [])[0] || {}).color || '';
  const colVars = a.variants.filter(v => v.color === color);
  const v = colVars.find(v => v.available_qty > 0) || colVars[0];
  if (!v || v.available_qty <= 0) return toast('Out of stock');
  const price = v.price != null ? v.price : a.base_price;
  const label = a.article_code + ' ' + color + (v.size ? ' ' + v.size : '');
  if (CART[v.id]) CART[v.id].qty = Math.min(CART[v.id].qty + 1, v.available_qty);
  else CART[v.id] = { qty: 1, label, price };
  saveCart();
  cartAddedToast(label);
  renderCart();
}
function youMayLikeHTML() {
  let ids = [];
  try { ids = JSON.parse(ARTICLE.related_ids || '[]'); } catch (e) { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  const recs = ids.map(id => DATA.articles.find(a => String(a.id) === String(id)))
    .filter(a => a && String(a.id) !== String(ARTICLE.id));
  if (!recs.length) return '';
  return '<section class="rec-sec">' +
    '<h2 class="rec-title">You may also like</h2>' +
    '<div class="rec-row-wrap">' +
      '<button class="rec-arr prev" onclick="recScroll(-1)">&#8249;</button>' +
      '<div class="rec-row" id="recRow">' + recs.map(recCard).join('') + '</div>' +
      '<button class="rec-arr next" onclick="recScroll(1)">&#8250;</button>' +
    '</div>' +
  '</section>';
}
function similarProductsHTML() {
  if (!ARTICLE.category) return '';
  const sims = DATA.articles.filter(a => a.category === ARTICLE.category && String(a.id) !== String(ARTICLE.id));
  if (!sims.length) return '';
  return '<section class="rec-sec">' +
    '<h2 class="rec-title">Similar products</h2>' +
    '<div class="rec-grid">' + sims.map(recCard).join('') + '</div>' +
  '</section>';
}
function recScroll(dir) {
  const row = document.getElementById('recRow'); if (!row) return;
  row.scrollBy({ left: dir * row.clientWidth * 0.8, behavior: 'smooth' });
}
function openProductNav(id) {
  if (String(id) === String(PRODUCT_ID)) { window.scrollTo(0, 0); return; }
  window.location.href = '/product.html?id=' + encodeURIComponent(id) + '&t=' + encodeURIComponent(TOKEN);
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

  // Gallery HTML — all photos sit side by side in a sliding track so switching
  // photos animates smoothly instead of hard-cutting. Pinch/hold-to-zoom
  // happens right here in place (see the pointer handlers below). Tapping the
  // photo expands #pdpMainWrap into a fullscreen popup (via a CSS class, not a
  // separate element) so the exact same track/zoom code drives both views.
  const mainImg = photos.length
    ? '<div class="pdp-slide-track" id="pdpSlideTrack" style="transform:translateX(-' + (idx * 100) + '%)">' +
        photos.map(p =>
          '<div class="pdp-slide"><img class="pdp-slide-img" src="' + esc(p.url) + '" alt="' + esc(a.name || '') + '" draggable="false"></div>'
        ).join('') +
      '</div>' +
      '<button class="pdp-zoom-close" onclick="event.stopPropagation();closeZoomView()" aria-label="Close">&#10005;</button>' +
      '<div class="pdp-zoom-counter" id="pdpZoomCounter">' + (idx + 1) + ' / ' + photos.length + '</div>'
    : '<div class="no-photo" style="height:100%">No photo</div>';

  const thumbsHTML = photos.length > 1
    ? '<div class="pdp-thumbs">' +
        photos.map((p, i) =>
          '<img class="pdp-thumb' + (i === idx ? ' on' : '') + '" src="' + esc(p.url) + '" loading="lazy" onclick="goPhoto(' + i + ')">'
        ).join('') +
      '</div>'
    : '';

  const arrowsHTML = photos.length > 1
    ? '<button class="pdp-arr prev" id="pdpArrPrev" onclick="prevPhoto()" style="visibility:' + (idx > 0 ? 'visible' : 'hidden') + '">&#8249;</button>' +
      '<button class="pdp-arr next" id="pdpArrNext" onclick="nextPhoto()" style="visibility:' + (idx < photos.length - 1 ? 'visible' : 'hidden') + '">&#8250;</button>'
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
  const track = document.getElementById('pdpSlideTrack');
  if (track) { track.classList.remove('dragging'); track.style.transform = 'translateX(-' + (PHOTO_IDX * 100) + '%)'; }
  document.querySelectorAll('.pdp-thumb').forEach((t, j) => t.classList.toggle('on', j === PHOTO_IDX));
  const prevArr = document.getElementById('pdpArrPrev'), nextArr = document.getElementById('pdpArrNext');
  if (prevArr) prevArr.style.visibility = PHOTO_IDX > 0 ? 'visible' : 'hidden';
  if (nextArr) nextArr.style.visibility = PHOTO_IDX < photos.length - 1 ? 'visible' : 'hidden';
  const counter = document.getElementById('pdpZoomCounter');
  if (counter) counter.textContent = (PHOTO_IDX + 1) + ' / ' + photos.length;
  resetZoom();
}
function prevPhoto() {
  if (PHOTO_IDX <= 0) return; // already at the first photo — don't wrap
  goPhoto(PHOTO_IDX - 1);
}
function nextPhoto() {
  const photos = resolvePhotos(SEL.color);
  if (PHOTO_IDX >= photos.length - 1) return; // already at the last photo — don't wrap
  goPhoto(PHOTO_IDX + 1);
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
  cartAddedToast(label);
  renderCart();
  renderPDP();
}

// ── Cart ──
function renderCart() {
  const ids = Object.keys(CART);
  const count = ids.reduce((n, id) => n + CART[id].qty, 0);
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
  const badgeD = document.getElementById('navdCartBadge');
  if (badgeD) { badgeD.textContent = count; badgeD.style.display = count ? 'flex' : 'none'; }
  const emptyBtn = document.getElementById('cartEmptyBtn');
  if (emptyBtn) emptyBtn.style.display = ids.length ? 'inline' : 'none';
  let total = 0;
  document.getElementById('cartLines').innerHTML = ids.map(id => {
    total += (CART[id].price || 0) * CART[id].qty;
    return cartLineHTML(id, CART[id]);
  }).join('') || '<p class="muted">Cart is empty.</p>';
  document.getElementById('cartTotal').innerHTML = SHOW_PRICES && ids.length ? 'Est. total: <strong>' + esc(CUR) + total + '</strong>' : '';
}

// Look up the article + variant behind a cart line (cart is keyed by variant id).
function cartVariant(id) {
  if (!DATA) return null;
  for (const a of DATA.articles) {
    const v = (a.variants || []).find(x => x.id === id);
    if (v) return { a, v };
  }
  return null;
}
function cartPhotoFor(a, color) {
  const all = a.photos || [];
  const forC = color ? all.filter(p => p.color === color) : all;
  if (forC.length) return forC[0].url;
  if (all.length) return all[0].url;
  return getPlaceholder(a);
}

function cartLineHTML(id, c) {
  const jid = jq(id);
  const cv = cartVariant(id);
  if (!cv) {
    return '<div class="citem"><div class="citem-body"><div class="citem-top">' +
      '<div class="citem-name">' + esc(c.label || 'Item') + ' <span class="muted">× ' + c.qty + '</span></div>' +
      '<button class="citem-x" onclick="removeItem(\'' + jid + '\')">✕</button>' +
    '</div></div></div>';
  }
  const a = cv.a, v = cv.v;
  const img = cartPhotoFor(a, v.color);
  const colours = [...new Set(a.variants.map(x => x.color).filter(Boolean))];
  const sizesForColour = a.variants.filter(x => x.color === v.color && x.size && x.size.trim());
  const lineTotal = (c.price || 0) * c.qty;

  const colourSel = colours.length > 1
    ? '<label>Colour<select onchange="changeCartColour(\'' + jid + '\', this.value)">' +
        colours.map(col => '<option' + (col === v.color ? ' selected' : '') + '>' + esc(col) + '</option>').join('') +
      '</select></label>'
    : (v.color ? '<label>Colour<select disabled><option>' + esc(v.color) + '</option></select></label>' : '');

  const sizeSel = sizesForColour.length
    ? '<label>Size<select onchange="changeCartSize(\'' + jid + '\', this.value)">' +
        sizesForColour.map(sv => '<option' + (sv.size === v.size ? ' selected' : '') + (sv.available_qty <= 0 ? ' disabled' : '') + '>' + esc(sv.size) + '</option>').join('') +
      '</select></label>'
    : '';

  return '<div class="citem">' +
    '<div class="citem-img" onclick="openCartProduct(\'' + jid + '\')"><img src="' + esc(img) + '" alt=""></div>' +
    '<div class="citem-body">' +
      '<div class="citem-top">' +
        '<div class="citem-name" onclick="openCartProduct(\'' + jid + '\')">' + esc(a.name || a.article_code) + '</div>' +
        '<button class="citem-x" title="Remove" onclick="removeItem(\'' + jid + '\')">✕</button>' +
      '</div>' +
      '<div class="citem-opts">' + colourSel + sizeSel + '</div>' +
      '<div class="citem-bottom">' +
        '<div class="citem-stepper">' +
          '<button onclick="cartQtyDelta(\'' + jid + '\',-1)">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button onclick="cartQtyDelta(\'' + jid + '\',1)">+</button>' +
        '</div>' +
        (SHOW_PRICES ? '<div class="citem-price">' + esc(CUR) + ' ' + lineTotal + '</div>' : '') +
      '</div>' +
    '</div>' +
  '</div>';
}

function cartQtyDelta(id, d) {
  if (!CART[id]) return;
  const cv = cartVariant(id);
  const max = cv ? (cv.v.available_qty || 1) : CART[id].qty;
  let q = (CART[id].qty || 1) + d;
  if (q < 1) q = 1;
  if (q > max) { q = max; toast('Only ' + max + ' in stock'); }
  CART[id].qty = q;
  saveCart(); renderCart(); renderPDP();
}
function moveCartVariant(oldId, nv, a) {
  if (!nv || nv.id === oldId) return;
  const oldQty = (CART[oldId] && CART[oldId].qty) || 1;
  const price = nv.price != null ? nv.price : a.base_price;
  const label = a.article_code + ' ' + nv.color + (nv.size ? ' ' + nv.size : '');
  const want = Math.min(oldQty, nv.available_qty || 1) || 1;
  if (CART[nv.id]) CART[nv.id].qty = Math.min(CART[nv.id].qty + want, nv.available_qty || want);
  else CART[nv.id] = { qty: want, label, price };
  delete CART[oldId];
  saveCart(); renderCart(); renderPDP();
}
function changeCartColour(id, colour) {
  const cv = cartVariant(id); if (!cv) return;
  const colVars = cv.a.variants.filter(x => x.color === colour);
  const nv = colVars.find(x => x.size === cv.v.size && x.available_qty > 0)
    || colVars.find(x => x.available_qty > 0) || colVars[0];
  if (!nv) return toast('That colour is unavailable');
  moveCartVariant(id, nv, cv.a);
}
function changeCartSize(id, size) {
  const cv = cartVariant(id); if (!cv) return;
  const nv = cv.a.variants.find(x => x.color === cv.v.color && x.size === size);
  if (!nv) return;
  if (nv.available_qty <= 0) return toast('That size is sold out');
  moveCartVariant(id, nv, cv.a);
}
function openCartProduct(id) {
  const cv = cartVariant(id); if (!cv) return;
  closeCart();
  if (String(cv.a.id) === String(PRODUCT_ID)) { window.scrollTo(0, 0); return; }
  window.location.href = '/product.html?id=' + encodeURIComponent(cv.a.id) + '&t=' + encodeURIComponent(TOKEN);
}

function removeItem(id) {
  delete CART[id]; saveCart(); renderCart(); renderPDP();
}
function emptyCart() {
  if (!Object.keys(CART).length) return;
  if (!confirm('Remove all items from your cart?')) return;
  Object.keys(CART).forEach(id => delete CART[id]);
  saveCart();
  renderCart();
  renderPDP();
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

// ── Inline photo zoom + smooth slide (pinch / hold-to-zoom right where the
// photo sits) + fullscreen popup, driven by the exact same track/zoom code —
// opening the popup just expands #pdpMainWrap over the whole screen via CSS. ──
const Z = { scale: 1, x: 0, y: 0, pointers: new Map(), startDist: 0, startScale: 1, panStart: null };
const MAX_ZOOM = 3;

function openZoomView() {
  const wrap = document.getElementById('pdpMainWrap');
  if (!wrap || wrap.classList.contains('pdp-zoom-open')) return;
  wrap.classList.add('pdp-zoom-open');
  document.body.style.overflow = 'hidden';
}
function closeZoomView() {
  const wrap = document.getElementById('pdpMainWrap');
  if (!wrap || !wrap.classList.contains('pdp-zoom-open')) return;
  wrap.classList.remove('pdp-zoom-open');
  document.body.style.overflow = '';
  resetZoom();
}
function toggleZoomView() {
  const wrap = document.getElementById('pdpMainWrap');
  if (wrap && wrap.classList.contains('pdp-zoom-open')) closeZoomView(); else openZoomView();
}

function activeSlideImg() {
  const track = document.getElementById('pdpSlideTrack');
  const slide = track && track.children[PHOTO_IDX];
  return slide ? slide.querySelector('img') : null;
}
function resetZoom() {
  Z.scale = 1; Z.x = 0; Z.y = 0;
  applyZoom(true);
}
// smooth=true animates the jump (double-tap / reset); pinch & pan track the
// finger 1:1 so they skip the transition to stay responsive.
function applyZoom(smooth) {
  const img = activeSlideImg();
  if (!img) return;
  img.classList.toggle('zoom-anim', !!smooth);
  img.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.scale + ')';
}
function zDist(pts) {
  const [a, b] = pts;
  return Math.hypot(a.x - b.x, a.y - b.y);
}
// The close (X) button and prev/next arrows sit inside #pdpMainWrap but must
// never feed the pinch/pan/tap gesture system — if a tap on the close button
// also toggled the zoom view via the generic tap handler, the popup would
// close mid-pointerup, and the browser's follow-up synthetic "click" event
// would then hit-test against whatever is now underneath (e.g. the navbar's
// cart button), effectively clicking through to it. Their own onclick
// handlers run the actions instead.
function isZoomControl(target) { return !!target.closest('.pdp-zoom-close, .pdp-arr'); }

(function() {
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#pdpMainWrap') || isZoomControl(e.target)) return;
    Z.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Z.pointers.size === 2) {
      const pts = [...Z.pointers.values()];
      Z.startDist = zDist(pts);
      Z.startScale = Z.scale;
    } else if (Z.pointers.size === 1) {
      Z.panStart = { x: e.clientX, y: e.clientY, lx: Z.x, ly: Z.y };
    }
  });

  document.addEventListener('pointermove', e => {
    if (!Z.pointers.has(e.pointerId)) return;
    Z.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Z.pointers.size === 2) {
      const pts = [...Z.pointers.values()];
      const dist = zDist(pts);
      const factor = dist / (Z.startDist || dist);
      Z.scale = Math.max(1, Math.min(MAX_ZOOM, Z.startScale * factor));
      applyZoom();
    } else if (Z.pointers.size === 1 && Z.scale > 1.01 && Z.panStart) {
      Z.x = Z.panStart.lx + (e.clientX - Z.panStart.x);
      Z.y = Z.panStart.ly + (e.clientY - Z.panStart.y);
      applyZoom();
    }
  });

  function endPointer(e) {
    const wasSingle = Z.pointers.size === 1;
    const wasZoomed = Z.scale > 1.01;
    const panStart = Z.panStart;
    Z.pointers.delete(e.pointerId);
    if (wasSingle && !wasZoomed && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) nextPhoto(); else prevPhoto();
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        toggleZoomView(); // a plain tap opens the fullscreen popup (or closes it if already open)
      }
    }
    if (Z.pointers.size === 0) {
      // Zoom only lives while a finger is touching the photo — the moment
      // every finger lifts, spring back to the normal (unzoomed) view.
      if (Z.scale > 1.01) resetZoom();
      Z.panStart = null;
    }
  }
  document.addEventListener('pointerup', e => { if (isZoomControl(e.target)) return; if (e.target.closest('#pdpMainWrap') || Z.pointers.has(e.pointerId)) endPointer(e); });
  document.addEventListener('pointercancel', e => { if (Z.pointers.has(e.pointerId)) endPointer(e); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeZoomView();
  });

  document.addEventListener('wheel', e => {
    if (!e.target.closest('#pdpMainWrap')) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    Z.scale = Math.max(1, Math.min(MAX_ZOOM, Z.scale + delta));
    if (Z.scale <= 1.01) { Z.scale = 1; Z.x = 0; Z.y = 0; }
    applyZoom();
  }, { passive: false });
})();

// ── Utils ──
function jq(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// ── Start ──
init();
