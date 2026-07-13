// ── State ──
const TOKEN = qs('t');
let DATA = null;
let CUR = 'Rs.';
let SHOW_PRICES = true;
let VIEW = 'home';       // 'home' | 'catalogue'
let CAT_FILTER = '';     // current category in catalogue view
let NEW_ARR = false;     // catalogue view is showing New Arrivals only
const FILTER = { color: '', size: '', price_min: '', price_max: '', q: '' };
let SORT = 'default';
const CART = {};
const SELECTION = {};
const PHOTO_IDX = {};
let MODAL_AID = null;
let BANNER_IDX = 0;
let BANNER_TIMER = null;
let MENU_OPEN = false;
let MENU_SUBCAT = null;
let FILTER_OPEN = false;
let SORT_OPEN = false;
let FILTER_SECTION_OPEN = { color: true, size: false, price: false };

const COLOR_CSS = {
  'Black':'#1C1C1C','Brown':'#7B4B2A','Red':'#CC2200','Beige':'#D4B896',
  'Navy':'#1B2A6B','Cream':'#F0E6CC','Green':'#2E7D32','Pink':'#E91E63',
  'White':'#EBEBEB','Grey':'#757575','Blue':'#1565C0','Olive':'#6D7B2C',
  'Tan':'#C8965C','Burgundy':'#7B1A2A','Gold':'#C9962E','Purple':'#6A1B9A',
  // Extended palette for new catalogue
  'Silver':'#C0C0C0','Black/Grey':'#3D3D3D','Deep Black':'#0A0A0A',
  'Midnight Blue':'#0D1B4B','Navy Blue':'#1B2A6B','Dark Navy':'#0D1426',
  'Brushed Silver':'#B8BCC0','Ivory Gold':'#D4C070','Stormy Weather':'#6B7280',
  'Brushed Black':'#2A2A2A','Grey Blue':'#5B7FA6','Mocha':'#7C5C45',
  'Bright Lime':'#9ACD32','Dusty Pink':'#D4A0A0','Blush':'#FFB6C1',
  'Nude':'#E8C9A0','Camel':'#C19A6B','Teal':'#008080','Coral':'#FF6B6B',
  'Orange':'#FF8C00','Yellow':'#FFD700','Natural':'#D4C5A9',
};

// ── Smart placeholder photos (keyword → curated Unsplash ID) ──
const PLACEHOLDER_MAP = [
  ['trekking',  'photo-1501555088652-021faa106b9b'],
  ['trek',      'photo-1501555088652-021faa106b9b'],
  ['hiking',    'photo-1501555088652-021faa106b9b'],
  ['travel',    'photo-1488646953014-85cb44e25828'],
  ['luggage',   'photo-1553482085-9cbe3a9b8008'],
  ['trolley',   'photo-1562157873-818bc0726f68'],
  ['suitcase',  'photo-1594035910387-fea47794261f'],
  ['laptop',    'photo-1622560480605-d83c853bc5c3'],
  ['office',    'photo-1622560480605-d83c853bc5c3'],
  ['college',   'photo-1553062407-98eeb64c6a62'],
  ['school',    'photo-1553062407-98eeb64c6a62'],
  ['backpack',  'photo-1553062407-98eeb64c6a62'],
  ['back pack', 'photo-1553062407-98eeb64c6a62'],
  ['sling',     'photo-1614179818511-68c10c1bbca5'],
  ['crossbody', 'photo-1614179818511-68c10c1bbca5'],
  ['cross body','photo-1614179818511-68c10c1bbca5'],
  ['clutch',    'photo-1566150905458-1bf1fc113f0d'],
  ['wallet',    'photo-1627123424574-724758594785'],
  ['purse',     'photo-1548036328-c9fa89d128fa'],
  ['ladies',    'photo-1548036328-c9fa89d128fa'],
  ['women',     'photo-1590874103328-eac38a683ce7'],
  ['girl',      'photo-1590874103328-eac38a683ce7'],
  ['tote',      'photo-1584917865442-de89df76afd3'],
  ['shopper',   'photo-1584917865442-de89df76afd3'],
  ['jute',      'photo-1572635196237-14b3f281503f'],
  ['eco',       'photo-1572635196237-14b3f281503f'],
  ['shopping',  'photo-1512436991641-6745cdb1723f'],
  ['gym',       'photo-1544966503-7cc5ac882d5f'],
  ['duffel',    'photo-1544966503-7cc5ac882d5f'],
  ['duffle',    'photo-1544966503-7cc5ac882d5f'],
  ['sports',    'photo-1544966503-7cc5ac882d5f'],
  ['messenger', 'photo-1598532213919-078e54dd1f40'],
  ['satchel',   'photo-1598532213919-078e54dd1f40'],
  ['handbag',   'photo-1548036328-c9fa89d128fa'],
  ['hand bag',  'photo-1548036328-c9fa89d128fa'],
];

function getSmartPlaceholder(a) {
  const text = ((a.name || '') + ' ' + (a.category || '')).toLowerCase();
  for (const [keyword, id] of PLACEHOLDER_MAP) {
    if (text.includes(keyword)) {
      return 'https://images.unsplash.com/' + id + '?w=600&auto=format&fit=crop&q=80';
    }
  }
  // Generic bag fallback
  return 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80';
}

// Returns photos to display for a given article + color; injects smart placeholder if none uploaded
function resolvePhotos(a, color) {
  const all = a.photos || [];
  const forColor = color ? all.filter(p => p.color === color) : all;
  if (forColor.length) return forColor;
  if (all.length) return all;
  // No photos uploaded — return a smart placeholder as a synthetic photo object
  return [{ url: getSmartPlaceholder(a), _placeholder: true }];
}

// ── SVG icons ──
const IC_CART = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
const IC_OK = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
const IC_IG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
const IC_FB = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>';
const IC_INFO = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
const IC_FIRE = '⚡';

// ── Init ──
async function init() {
  if (!TOKEN) return showExpired();
  const { ok, status, data } = await api('/api/catalog?token=' + encodeURIComponent(TOKEN));
  if (status === 403) return showExpired();
  if (!ok || !data) {
    document.getElementById('app').innerHTML = '<div class="notice">Could not load. Please try again.</div>';
    return;
  }
  DATA = data;
  CUR = data.shop.currency || 'Rs.';
  SHOW_PRICES = !!data.shop.show_prices;
  document.getElementById('navShopName').textContent = data.shop.name || '';
  document.getElementById('mobShopName').textContent = data.shop.name || '';
  const navdShopName = document.getElementById('navdShopName');
  if (navdShopName) navdShopName.textContent = data.shop.name || '';
  applyBranding(data.shop);
  loadCartFromStorage();
  renderNav();
  renderMobMenu();
  syncStickyOffsets();
  // A search submitted from the product page's header hands its query off
  // here (no product grid to filter over there) — pick it up once and clear it.
  let pendingSearch = '';
  try { pendingSearch = localStorage.getItem('bag_pending_search') || ''; localStorage.removeItem('bag_pending_search'); } catch (e) {}

  // Restore the view from the URL so returning from a product (Back button or the
  // phone's back) lands the customer back in the category/new-arrivals they were in.
  const urlCat = qs('cat'), urlNew = qs('new');
  if (pendingSearch) {
    VIEW = 'catalogue'; CAT_FILTER = ''; NEW_ARR = false; FILTER.q = pendingSearch;
    stopBanner();
    syncCatalogUrl();
    renderApp();
    const si = document.getElementById('navSearchInput'); if (si) si.value = pendingSearch;
    const sdi = document.getElementById('navdSearchInput'); if (sdi) sdi.value = pendingSearch;
  } else if (urlNew) goNewArrivals();
  else if (urlCat) goCategory(urlCat, qs('color') || '', qs('size') || '');
  else goHome();
}

function showExpired() {
  document.getElementById('app').innerHTML =
    '<div class="notice card"><h2>Link expired</h2>' +
    '<p class="muted" style="margin-top:8px">This catalogue link is no longer active. Please message us on WhatsApp to get a fresh link.</p></div>';
}

// ── Navigation ──
function goHome() {
  VIEW = 'home';
  NEW_ARR = false;
  BANNER_IDX = 0;
  closeMenu();
  closeNavSearch();
  syncCatalogUrl();
  renderApp();
  window.scrollTo(0, 0);
}

// Keep the browser URL in sync with the current view. Without this, tapping a
// category only changes JS state, so the catalogue's history entry stays at the
// home URL — and pressing Back from a product (top Back button OR the phone's back)
// reloads that home URL, dumping the customer on the homepage instead of the
// category they were in. replaceState updates the URL in place (no history pile-up),
// so Back returns to /s.html?cat=… and init() re-opens that category.
function syncCatalogUrl() {
  const p = new URLSearchParams();
  if (TOKEN) p.set('t', TOKEN);
  if (VIEW === 'catalogue') {
    if (NEW_ARR) p.set('new', '1');
    else if (CAT_FILTER) p.set('cat', CAT_FILTER);
    if (FILTER.color) p.set('color', FILTER.color);
    if (FILTER.size) p.set('size', FILTER.size);
  }
  try { history.replaceState(null, '', '/s.html?' + p.toString()); } catch (e) {}
}

function goCategory(cat, color, size) {
  VIEW = 'catalogue';
  CAT_FILTER = cat || '';
  NEW_ARR = false;
  FILTER.color = color || '';
  FILTER.size = size || '';
  FILTER.price_min = '';
  FILTER.price_max = '';
  FILTER.q = '';
  SORT = 'default';
  closeMenu();
  closeNavSearch();
  stopBanner();
  syncCatalogUrl();
  window.scrollTo(0, 0);
  renderApp();
}

// New Arrivals "View All" → catalogue page showing only new-arrival products.
function goNewArrivals() {
  VIEW = 'catalogue';
  CAT_FILTER = '';
  NEW_ARR = true;
  FILTER.color = ''; FILTER.size = ''; FILTER.price_min = ''; FILTER.price_max = ''; FILTER.q = '';
  SORT = 'default';
  closeMenu();
  closeNavSearch();
  stopBanner();
  syncCatalogUrl();
  window.scrollTo(0, 0);
  renderApp();
}

function renderApp() {
  if (VIEW === 'home') {
    renderHomepage();
    startBanner();
  } else {
    stopBanner();
    renderCataloguePage();
  }
  renderNav();
  renderCart();
}

// Measure the fixed navbar's real height and pin the sticky toolbar exactly to it
// (removes the gap that appeared when the toolbar's `top` didn't match the nav height).
function syncStickyOffsets() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const h = nav.offsetHeight;
  document.documentElement.style.setProperty('--nav-h', h + 'px');
  const app = document.getElementById('app');
  if (app) app.style.paddingTop = h + 'px';
}
window.addEventListener('resize', syncStickyOffsets);
window.addEventListener('load', syncStickyOffsets);

// ── Navbar ──
function renderNav() {
  // Header shows the admin-controlled menu list (max 10), falling back to the
  // first 10 categories if none configured.
  const cats = DATA
    ? ((DATA.nav_categories && DATA.nav_categories.length ? DATA.nav_categories : (DATA.filters.categories || [])).slice(0, 10))
    : [];
  // No separate "Home" link — tapping the logo already goes home.
  const catsHtml =
    cats.map(c =>
      '<button class="nav-cat-link' + (VIEW === 'catalogue' && CAT_FILTER === c ? ' active' : '') + '"' +
      ' onclick="goCategory(\'' + jq(c) + '\')">' + esc(c) + '</button>'
    ).join('') +
    '<button class="nav-cat-link' + (VIEW === 'catalogue' && !CAT_FILTER ? ' active' : '') + '" onclick="goCategory(\'\')">Shop All</button>';
  // Same admin-configured list feeds both the mobile/narrow bar (#navCatsBar)
  // and the single-row desktop header (#navdCatsBar).
  const bar = document.getElementById('navCatsBar');
  if (bar) bar.innerHTML = catsHtml;
  const barD = document.getElementById('navdCatsBar');
  if (barD) barD.innerHTML = catsHtml;

  // update cart badges (mobile + desktop)
  const total = Object.values(CART).reduce((n, c) => n + c.qty, 0);
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = total; badge.style.display = total ? 'flex' : 'none'; }
  const badgeD = document.getElementById('navdCartBadge');
  if (badgeD) { badgeD.textContent = total; badgeD.style.display = total ? 'flex' : 'none'; }
}

// Desktop dropdown disabled — categories navigate directly on click
function openDesktopDropdown() {}
function closeDesktopDropdown() {}
function scheduleCloseDD() {}

// Search
function toggleNavSearch() {
  const bar = document.getElementById('navSearchBar');
  const showing = bar.style.display !== 'none';
  if (showing) { closeNavSearch(); } else { bar.style.display = 'block'; syncStickyOffsets(); setTimeout(() => document.getElementById('navSearchInput').focus(), 50); }
}
function closeNavSearch() {
  const bar = document.getElementById('navSearchBar');
  if (bar) bar.style.display = 'none';
  syncStickyOffsets();
  const inp = document.getElementById('navSearchInput');
  if (inp) inp.value = '';
}
let _searchTimer = null;
function onSearchInput(val) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    FILTER.q = val.trim();
    if (FILTER.q) {
      if (VIEW !== 'catalogue') { VIEW = 'catalogue'; CAT_FILTER = ''; }
      NEW_ARR = false; // a search spans all products, not just new arrivals
      stopBanner();
      renderCataloguePage();
    } else if (VIEW === 'catalogue') {
      renderCataloguePage();
    }
  }, 250);
}

// ── Mobile Menu ──
function toggleMenu() { MENU_OPEN ? closeMenu() : openMenu(); }
function openMenu() {
  MENU_OPEN = true;
  document.getElementById('mobOverlay').classList.add('open');
  document.getElementById('mobMenu').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  MENU_OPEN = false;
  MENU_SUBCAT = null;
  document.getElementById('mobOverlay').classList.remove('open');
  document.getElementById('mobMenu').classList.remove('open');
  document.body.style.overflow = '';
  // reset sub-panel
  const sub = document.getElementById('mobPanelSub');
  const main = document.getElementById('mobPanelMain');
  if (sub) sub.style.display = 'none';
  if (main) main.style.display = 'flex';
}

function renderMobMenu() {
  if (!DATA) return;
  // Same admin-controlled menu list (and order/count, up to 10) as the desktop
  // header — falls back to all categories only if the admin hasn't set one.
  const cats = (DATA.nav_categories && DATA.nav_categories.length ? DATA.nav_categories : (DATA.filters.categories || [])).slice(0, 10);
  const shop = DATA.shop || {};

  document.getElementById('mobCatsList').innerHTML =
    cats.map(c =>
      '<div class="mob-cat-item" onclick="goCategory(\'' + jq(c) + '\')">' +
        '<span>' + esc(c.toUpperCase()) + '</span>' +
        '<span class="mob-arr">›</span>' +
      '</div>'
    ).join('') +
    '<div class="mob-cat-item" onclick="goCategory(\'\')">' +
      '<span>SHOP ALL</span>' +
      '<span class="mob-arr">›</span>' +
    '</div>';

  const foot = document.getElementById('mobMenuFoot');
  if (foot) {
    foot.innerHTML =
      (shop.about_us ? '<div class="mob-foot-link">' + IC_INFO + ' <span>' + esc(shop.about_us) + '</span></div>' : '') +
      (shop.instagram_url ? '<a class="mob-foot-link" href="' + esc(shop.instagram_url) + '" target="_blank">' + IC_IG + ' Instagram</a>' : '') +
      (shop.facebook_url  ? '<a class="mob-foot-link" href="' + esc(shop.facebook_url)  + '" target="_blank">' + IC_FB + ' Facebook</a>' : '');
  }
}

function openMobSubCat(cat) {
  MENU_SUBCAT = cat;
  const articles = (DATA.articles || []).filter(a => a.category === cat);
  const allVars  = articles.flatMap(a => a.variants || []);
  const colors   = [...new Set(allVars.map(v => v.color).filter(Boolean))];
  const sizes    = [...new Set(allVars.map(v => v.size).filter(Boolean))];

  document.getElementById('mobSubTitle').textContent = cat.toUpperCase();

  const typeGrid = articles.slice(0, 6).map(a => {
    const photo = (a.photos || [])[0];
    return '<div class="mob-type-item" onclick="openDetail(\'' + jq(a.id) + '\');closeMenu()">' +
      '<div class="mob-type-img">' +
        (photo ? '<img src="' + esc(photo.url) + '" alt="" loading="lazy">' : '') +
      '</div>' +
      '<div class="mob-type-name">' + esc(a.name || a.article_code) + '</div>' +
    '</div>';
  }).join('');

  const colorSection = colors.length
    ? '<div class="mob-sub-section">' +
        '<div class="mob-sub-head" onclick="toggleMobSection(this)">COLOUR <span class="mob-arr">›</span></div>' +
        '<div class="mob-sub-body" style="display:none">' +
          '<div class="mob-color-grid">' +
            colors.map(c =>
              '<div class="mob-color-item" onclick="goCategory(\'' + jq(cat) + '\',\'' + jq(c) + '\')">' +
                '<div class="mob-color-swatch" style="background:' + (COLOR_CSS[c] || '#ccc') + '"></div>' +
                '<div>' + esc(c) + '</div>' +
              '</div>'
            ).join('') +
          '</div>' +
        '</div>' +
      '</div>'
    : '';

  const sizeSection = sizes.length
    ? '<div class="mob-sub-section">' +
        '<div class="mob-sub-head" onclick="toggleMobSection(this)">SIZE <span class="mob-arr">›</span></div>' +
        '<div class="mob-sub-body" style="display:none">' +
          '<div class="mob-size-list">' +
            sizes.map(s =>
              '<div class="mob-size-chip" onclick="goCategory(\'' + jq(cat) + '\',\'\',\'' + jq(s) + '\')">' + esc(s) + '</div>'
            ).join('') +
          '</div>' +
        '</div>' +
      '</div>'
    : '';

  document.getElementById('mobSubContent').innerHTML =
    '<div class="mob-sub-section">' +
      '<div class="mob-sub-head expanded" onclick="toggleMobSection(this)">TYPE <span class="mob-arr">▾</span></div>' +
      '<div class="mob-sub-body" style="display:block">' +
        '<div class="mob-type-grid">' + typeGrid + '</div>' +
        '<span class="mob-shop-all" onclick="goCategory(\'' + jq(cat) + '\')">Shop all ' + esc(cat.toLowerCase()) + ' →</span>' +
      '</div>' +
    '</div>' +
    colorSection + sizeSection;

  document.getElementById('mobPanelMain').style.display = 'none';
  const sub = document.getElementById('mobPanelSub');
  sub.style.display = 'flex';
  requestAnimationFrame(() => sub.classList.add('open'));
}

function closeMobSubCat() {
  MENU_SUBCAT = null;
  const sub = document.getElementById('mobPanelSub');
  sub.classList.remove('open');
  document.getElementById('mobPanelMain').style.display = 'flex';
  setTimeout(() => { sub.style.display = 'none'; }, 240);
}

function toggleMobSection(head) {
  const body = head.nextElementSibling;
  const expanded = head.classList.toggle('expanded');
  head.querySelector('.mob-arr').textContent = expanded ? '▾' : '›';
  body.style.display = expanded ? 'block' : 'none';
}

// ── Homepage ──
function renderHomepage() {
  const app = document.getElementById('app');
  app.innerHTML = heroHTML() + taglineHTML() + newArrivalsHTML() + catTilesHTML() + footerHTML();
  initBannerSwipe();
  document.addEventListener('click', onDocClick, { once: false });
}

function taglineHTML() {
  const shop = DATA.shop || {};
  const text = shop.tagline || "LIFE'S A JOURNEY";
  return '<div class="tagline-section"><span class="tagline-line"></span><span class="tagline-text">' + esc(text) + '</span><span class="tagline-line"></span></div>';
}

function newArrivalsHTML() {
  const all = DATA.articles || [];
  const flagged = all.filter(a => a.is_new_arrival);
  const articles = flagged.length ? flagged.slice(0, 8) : all.slice(0, 8);
  if (!articles.length) return '';
  return '<div class="new-arrivals-section">' +
    '<div class="new-arrivals-head">' +
      '<h2>New Arrivals</h2>' +
      '<span class="view-all-link" onclick="goNewArrivals()">View All →</span>' +
    '</div>' +
    '<div class="na-scroll">' +
      articles.map(a => {
        const photo = resolvePhotos(a, '')[0];
        const minPrice = getMinPrice(a);
        return '<div class="na-card" onclick="openDetail(\'' + jq(a.id) + '\')">' +
          '<div class="na-photo">' +
            (photo ? '<img src="' + esc(photo.url) + '" alt="" loading="lazy">' : '<div class="no-photo">No photo</div>') +
          '</div>' +
          '<div class="na-info">' +
            '<div class="na-name">' + esc(a.name || a.article_code) + '</div>' +
            '<div class="na-desc">' + esc(a.description || a.article_code) + '</div>' +
            (SHOW_PRICES && minPrice ? '<div class="na-price">' + esc(CUR) + ' ' + minPrice + '/pc</div>' : '') +
          '</div>' +
          '<button class="na-atc" onclick="event.stopPropagation();quickAddToCart(\'' + jq(a.id) + '\')">ADD TO CART</button>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</div>';
}

function heroHTML() {
  const banners = (DATA.banners || []).filter(b => b.is_active);
  if (!banners.length) return '<div style="height:8px"></div>';
  // Tapping the banner opens its attached link (category/article/URL). Banners
  // with no link are not clickable. The whole image is the tap target now — the
  // old "Shop Now" button was removed.
  return '<div class="hero" id="hero">' +
    '<div class="hero-track" id="heroTrack">' +
      banners.map((b, i) =>
        '<div class="hero-slide' + (i === 0 ? ' on' : '') + '" data-idx="' + i + '"' +
          (b.link_url ? ' style="cursor:pointer" onclick="bannerTap()"' : '') + '>' +
          '<img src="' + esc(b.image_url) + '" alt="" ' + (i === 0 ? '' : 'loading="lazy"') + '>' +
        '</div>'
      ).join('') +
    '</div>' +
    (banners.length > 1
      ? '<button class="hero-arr prev" onclick="prevBanner()">&#8249;</button>' +
        '<button class="hero-arr next" onclick="nextBanner()">&#8250;</button>' +
        '<div class="hero-dots" id="heroDots">' +
          banners.map((_, i) => '<span class="hero-dot' + (i === 0 ? ' on' : '') + '" onclick="goBanner(' + i + ')"></span>').join('') +
        '</div>'
      : '') +
  '</div>';
}

function catTilesHTML() {
  const cats = (DATA.filters.categories || []);
  if (!cats.length) return '';
  const catImages = DATA.category_images || {};
  return '<div class="cat-section">' +
    '<div class="section-head"><h2>Our Collections</h2><p>Shop by Category</p></div>' +
    '<div class="cat-tiles">' +
      cats.map(c =>
        '<div class="cat-tile" onclick="goCategory(\'' + jq(c) + '\')">' +
          '<div class="cat-tile-img">' +
            (catImages[c]
              ? '<img src="' + esc(catImages[c]) + '" alt="' + esc(c) + '" loading="lazy">'
              : '<div class="cat-tile-placeholder">' + esc(c[0]) + '</div>'
            ) +
          '</div>' +
          '<div class="cat-tile-overlay"></div>' +
          '<div class="cat-tile-label">' +
            '<div class="cat-tile-name">' + esc(c) + '</div>' +
            '<div class="cat-tile-shop">Shop Now →</div>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>' +
  '</div>';
}

function footerHTML() {
  const shop = DATA.shop || {};
  return '<footer class="site-footer">' +
    '<div class="footer-inner">' +
      '<div class="footer-cols">' +
        // Col 1 — brand + about
        '<div class="footer-col">' +
          '<div class="footer-brand">' + esc(shop.name || 'Shop') + '</div>' +
          (shop.about_us ? '<p class="footer-about">' + esc(shop.about_us) + '</p>' : '') +
        '</div>' +
        // Col 2 — Support
        '<div class="footer-col">' +
          '<div class="footer-col-head">Support</div>' +
          '<ul class="footer-links">' +
            '<li>How to Order</li>' +
            '<li>Wholesale Pricing</li>' +
            '<li>Contact Us on WhatsApp</li>' +
          '</ul>' +
        '</div>' +
        // Col 3 — Follow Us
        '<div class="footer-col">' +
          '<div class="footer-col-head">Follow Us</div>' +
          '<div class="footer-social">' +
            (shop.instagram_url
              ? '<a class="footer-social-link" href="' + esc(shop.instagram_url) + '" target="_blank">' + IC_IG + ' Instagram</a>'
              : '') +
            (shop.facebook_url
              ? '<a class="footer-social-link" href="' + esc(shop.facebook_url) + '" target="_blank">' + IC_FB + ' Facebook</a>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<p class="footer-copy">© ' + new Date().getFullYear() + ' ' + esc(shop.name || 'Shop') + '. All rights reserved. Wholesale catalogue.</p>' +
      '</div>' +
    '</div>' +
  '</footer>';
}

// ── Banner ──
function startBanner() {
  stopBanner();
  const banners = (DATA && DATA.banners || []).filter(b => b.is_active);
  if (banners.length < 2) return;
  BANNER_TIMER = setInterval(() => { BANNER_IDX = (BANNER_IDX + 1) % banners.length; updateBannerUI(); }, 4000);
}
function stopBanner() { if (BANNER_TIMER) { clearInterval(BANNER_TIMER); BANNER_TIMER = null; } }
function prevBanner() { stopBanner(); const n = (DATA.banners || []).filter(b=>b.is_active).length; BANNER_IDX = (BANNER_IDX - 1 + n) % n; updateBannerUI(); startBanner(); }
function nextBanner() { stopBanner(); const n = (DATA.banners || []).filter(b=>b.is_active).length; BANNER_IDX = (BANNER_IDX + 1) % n; updateBannerUI(); startBanner(); }
function goBanner(idx) { stopBanner(); BANNER_IDX = idx; updateBannerUI(); startBanner(); }
function updateBannerUI() {
  const banners = (DATA.banners || []).filter(b => b.is_active);
  const slides = document.querySelectorAll('.hero-slide');
  slides.forEach((s, i) => s.classList.toggle('on', i === BANNER_IDX));
  const dots = document.querySelectorAll('.hero-dot');
  dots.forEach((d, i) => d.classList.toggle('on', i === BANNER_IDX));
}
// Tap anywhere on the banner → open its attached link. No link → do nothing.
function bannerTap() {
  const banners = (DATA.banners || []).filter(b => b.is_active);
  const b = banners[BANNER_IDX];
  if (b && b.link_url) handleBannerClick(b.link_url);
}
function initBannerSwipe() {
  const hero = document.getElementById('hero');
  if (!hero || hero._sw) return;
  hero._sw = true;
  let sx = 0;
  hero.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) { if (dx < 0) nextBanner(); else prevBanner(); }
  }, { passive: true });
}
function handleBannerClick(link) {
  if (!link || !DATA) return;
  // 1. match a category name
  const cats = DATA.filters.categories || [];
  if (cats.includes(link)) { goCategory(link); return; }
  // 2. match an article by ID or article_code
  const article = DATA.articles.find(a => a.id === link || a.article_code === link);
  if (article) { openDetail(article.id); return; }
  // 3. external URL
  if (link.startsWith('http')) { window.open(link, '_blank'); }
}

// ── Category hero ──
// Always shows a header banner for a category (photo if one is set, otherwise an
// on-brand coloured band) with the big category name — so opening a category from
// the top nav looks the same as opening it from a homepage tile.
function catHeroHTML() {
  if (!DATA) return '';
  if (NEW_ARR) {
    return '<div class="cat-hero cat-hero-plain">' +
      '<div class="cat-hero-text"><div class="cat-hero-name">NEW ARRIVALS</div></div>' +
    '</div>';
  }
  if (!CAT_FILTER) return '';
  const catImages = DATA.category_images || {};
  const img = catImages[CAT_FILTER];
  return '<div class="cat-hero' + (img ? '' : ' cat-hero-plain') + '">' +
    (img ? '<img class="cat-hero-img" src="' + esc(img) + '" alt="' + esc(CAT_FILTER) + '">' : '') +
    '<div class="cat-hero-text">' +
      '<div class="cat-hero-name">' + esc(CAT_FILTER.toUpperCase()) + '</div>' +
    '</div>' +
  '</div>';
}

// ── Catalogue Page ──
function renderCataloguePage() {
  const articles = getFiltered();
  const app = document.getElementById('app');
  const catLabel = NEW_ARR ? 'New Arrivals' : (CAT_FILTER || 'All Products');
  const filterCount = activeFilterCount();

  app.innerHTML =
    '<button class="cat-back" onclick="goHome()">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>' +
      ' Back to home' +
    '</button>' +
    catHeroHTML() +
    '<div class="cat-page">' +
      '<div class="cat-sticky-head">' +
        '<div class="cat-toolbar">' +
        '<button class="toolbar-btn" onclick="openMobFilters()">' +
          '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>' +
          ' Filters' +
          (filterCount ? ' <span class="filter-badge">' + filterCount + '</span>' : '') +
        '</button>' +
        '<span class="cat-count">' + articles.length + ' item' + (articles.length !== 1 ? 's' : '') + '</span>' +
        '<div class="sort-wrap">' +
          '<button class="toolbar-btn" onclick="toggleSort()">' +
            'Sort: <strong>' + getSortLabel() + '</strong>' +
            ' <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<div class="sort-dropdown' + (SORT_OPEN ? ' open' : '') + '">' +
            ['default','price_asc','price_desc','name_asc'].map(s =>
              '<button class="sort-opt' + (SORT === s ? ' on' : '') + '" onclick="setSort(\'' + s + '\')">' + getSortLabel(s) + '</button>'
            ).join('') +
          '</div>' +
        '</div>' +
      '</div>' + // .cat-toolbar
      '</div>' + // .cat-sticky-head
      '<div class="grid" id="grid">' +
        (articles.length ? articles.map(articleCard).join('') : '<p class="no-results muted">No items match. Try clearing filters.</p>') +
      '</div>' +
    '</div>' +
    footerHTML();

  renderFiltersPanel();
  initCardSwipe();
  // close sort dropdown on outside click
  document.addEventListener('click', onDocClick);
}

function getFiltered() {
  if (!DATA) return [];
  let list = DATA.articles;
  if (NEW_ARR) {
    // Show flagged new arrivals; if none are flagged, fall back to all (mirrors the
    // homepage New Arrivals strip so "View All" is never unexpectedly empty).
    const flagged = list.filter(a => a.is_new_arrival);
    if (flagged.length) list = flagged;
  }
  if (CAT_FILTER) list = list.filter(a => a.category === CAT_FILTER);
  if (FILTER.color) list = list.filter(a => a.variants.some(v => v.color === FILTER.color));
  if (FILTER.size)  list = list.filter(a => a.variants.some(v => v.size === FILTER.size));
  if (FILTER.q) { const q = FILTER.q.toLowerCase(); list = list.filter(a => (a.name || '').toLowerCase().includes(q) || (a.article_code || '').toLowerCase().includes(q)); }
  if (FILTER.price_min) list = list.filter(a => getMinPrice(a) >= Number(FILTER.price_min));
  if (FILTER.price_max) list = list.filter(a => getMinPrice(a) <= Number(FILTER.price_max));
  list = [...list];
  if (SORT === 'price_asc')  list.sort((a, b) => getMinPrice(a) - getMinPrice(b));
  if (SORT === 'price_desc') list.sort((a, b) => getMinPrice(b) - getMinPrice(a));
  if (SORT === 'name_asc')   list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return list;
}

function getMinPrice(a) {
  let min = a.base_price;
  (a.variants || []).forEach(v => { const p = v.price != null ? v.price : a.base_price; if (p != null && (min == null || p < min)) min = p; });
  return min || 0;
}

function activeFilterCount() {
  return [FILTER.color, FILTER.size, (FILTER.price_min || FILTER.price_max ? '1' : '')].filter(Boolean).length;
}

// Sort
function toggleSort() {
  SORT_OPEN = !SORT_OPEN;
  const dd = document.querySelector('.sort-dropdown');
  if (dd) dd.classList.toggle('open', SORT_OPEN);
}
function setSort(s) {
  SORT = s; SORT_OPEN = false;
  const dd = document.querySelector('.sort-dropdown');
  if (dd) dd.classList.remove('open');
  const grid = document.getElementById('grid');
  if (grid) {
    const articles = getFiltered();
    grid.innerHTML = articles.length ? articles.map(articleCard).join('') : '<p class="no-results muted">No items match.</p>';
    initCardSwipe();
  }
  // update button label
  const btn = document.querySelector('.sort-wrap .toolbar-btn strong');
  if (btn) btn.textContent = getSortLabel();
  // update sort opts
  document.querySelectorAll('.sort-opt').forEach(el => el.classList.toggle('on', el.textContent === getSortLabel()));
}
function getSortLabel(s) {
  const m = { default: 'Default', price_asc: 'Price: Low to High', price_desc: 'Price: High to Low', name_asc: 'Name A–Z' };
  return m[s || SORT] || 'Default';
}

// Filters panel
function renderFiltersPanel() {
  if (!DATA) return;
  const colors = DATA.filters.colors || [];
  const sizes  = DATA.filters.sizes  || [];
  const body = document.getElementById('filterPanelBody');
  if (!body) return;

  body.innerHTML =
    // Color section
    filterSectionHTML('color', 'Colour', FILTER_SECTION_OPEN.color,
      '<div class="filter-opts">' +
      colors.map(c =>
        '<button class="filter-opt' + (FILTER.color === c ? ' on' : '') + '" onclick="setFilter(\'color\',' + jq(c) + ')">' +
          '<span class="filter-dot" style="background:' + (COLOR_CSS[c] || '#999') + '"></span>' + esc(c) +
        '</button>'
      ).join('') + '</div>'
    ) +
    // Size section
    filterSectionHTML('size', 'Size', FILTER_SECTION_OPEN.size,
      '<div class="filter-opts">' +
      sizes.map(s =>
        '<button class="filter-opt' + (FILTER.size === s ? ' on' : '') + '" onclick="setFilter(\'size\',' + jq(s) + ')">' + esc(s) + '</button>'
      ).join('') + '</div>'
    ) +
    // Price section
    filterSectionHTML('price', 'Price', FILTER_SECTION_OPEN.price,
      '<div class="filter-opts">' +
        [['Under 500','','499'],['500–999','500','999'],['1000–1999','1000','1999'],['2000+','2000','']].map(([label, mn, mx]) => {
          const on = FILTER.price_min === mn && FILTER.price_max === mx;
          return '<button class="filter-opt' + (on ? ' on' : '') + '" onclick="setPriceRange(\'' + mn + '\',\'' + mx + '\')">' + CUR + label + '</button>';
        }).join('') +
      '</div>' +
      '<div class="price-range-inputs">' +
        '<input type="number" id="fp_min" placeholder="Min" value="' + (FILTER.price_min || '') + '" min="0">' +
        '<span style="color:var(--muted)">—</span>' +
        '<input type="number" id="fp_max" placeholder="Max" value="' + (FILTER.price_max || '') + '" min="0">' +
        '<button class="price-apply-btn" onclick="applyCustomPrice()">Apply</button>' +
      '</div>'
    );
}

function filterSectionHTML(key, title, open, content) {
  return '<div class="filter-section">' +
    '<div class="filter-section-head' + (open ? ' open' : '') + '" onclick="toggleFilterSection(\'' + key + '\')">' +
      esc(title) + '<span class="farr">' + (open ? '▴' : '▾') + '</span>' +
    '</div>' +
    '<div class="filter-section-body' + (open ? ' open' : '') + '">' + content + '</div>' +
  '</div>';
}

function toggleFilterSection(key) {
  FILTER_SECTION_OPEN[key] = !FILTER_SECTION_OPEN[key];
  renderFiltersPanel();
}

function setFilter(k, v) {
  FILTER[k] = FILTER[k] === v ? '' : v; // toggle
  renderFiltersPanel();
  refreshGrid();
}

function setPriceRange(mn, mx) {
  FILTER.price_min = mn; FILTER.price_max = mx;
  renderFiltersPanel();
  refreshGrid();
}

function applyCustomPrice() {
  FILTER.price_min = (document.getElementById('fp_min')?.value || '').trim();
  FILTER.price_max = (document.getElementById('fp_max')?.value || '').trim();
  refreshGrid();
}

function clearAllFilters() {
  FILTER.color = ''; FILTER.size = ''; FILTER.price_min = ''; FILTER.price_max = '';
  renderFiltersPanel();
  refreshGrid();
}

function clearFilter(k) {
  if (k === 'price') { FILTER.price_min = ''; FILTER.price_max = ''; }
  else FILTER[k] = '';
  refreshGrid();
}

function refreshGrid() {
  const articles = getFiltered();
  const grid = document.getElementById('grid');
  if (grid) {
    grid.innerHTML = articles.length ? articles.map(articleCard).join('') : '<p class="no-results muted">No items match. Try clearing filters.</p>';
    initCardSwipe();
  }
  // update toolbar filter badge
  const badge = document.querySelector('.toolbar-btn .filter-badge');
  const fc = activeFilterCount();
  if (badge) { badge.textContent = fc; badge.style.display = fc ? 'inline-flex' : 'none'; }
  // update item count
  const cnt = document.querySelector('.cat-count');
  if (cnt) cnt.textContent = articles.length + ' item' + (articles.length !== 1 ? 's' : '');
}

function openMobFilters() {
  FILTER_OPEN = true;
  renderFiltersPanel();
  document.getElementById('filterOverlay').classList.add('open');
  document.getElementById('filterPanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMobFilters() {
  FILTER_OPEN = false;
  document.getElementById('filterOverlay').classList.remove('open');
  document.getElementById('filterPanel').classList.remove('open');
  document.body.style.overflow = '';
  refreshGrid();
}

// ── Product card ──
function cardColor(a) {
  const sel = SELECTION[a.id];
  if (sel && sel.color) return sel.color;
  const colors = [...new Set((a.variants || []).map(v => v.color).filter(Boolean))];
  if (FILTER.color && colors.includes(FILTER.color)) return FILTER.color;
  return colors[0] || '';
}
function cardPhotos(a) {
  return resolvePhotos(a, cardColor(a));
}

function photoWrapHTML(a) {
  const photos = cardPhotos(a);
  const idx = Math.min(PHOTO_IDX[a.id] || 0, Math.max(0, photos.length - 1));
  const cartQty = (a.variants || []).reduce((n, v) => n + (CART[v.id] ? CART[v.id].qty : 0), 0);
  const totalQty = (a.variants || []).reduce((n, v) => n + (v.available_qty || 0), 0);
  const stockOverlay = totalQty === 0
    ? '<div class="card-stk out">Out of stock</div>'
    : totalQty < 10 ? '<div class="card-stk low">Only ' + totalQty + ' left</div>' : '';
  const img = photos.length
    ? '<img src="' + esc(photos[idx].url) + '" alt="" loading="lazy">'
    : '<div class="no-photo">No photo</div>';
  const dots = photos.length > 1
    ? '<div class="photo-dots">' + photos.map((_, i) =>
        '<span class="photo-dot' + (i === idx ? ' on' : '') + '" onclick="event.stopPropagation();goPhoto(\'' + jq(a.id) + '\',' + i + ')"></span>'
      ).join('') + '</div>'
    : '';
  return (photos.length > 1 ? '<button class="slide-btn prev" onclick="event.stopPropagation();prevPhoto(\'' + jq(a.id) + '\')">&#8249;</button>' : '') +
    img +
    (photos.length > 1 ? '<button class="slide-btn next" onclick="event.stopPropagation();nextPhoto(\'' + jq(a.id) + '\')">&#8250;</button>' : '') +
    dots +
    (cartQty ? '<div class="photo-badge">' + cartQty + ' in cart</div>' : '') +
    stockOverlay;
}

function articleCard(a) {
  const minPrice = getMinPrice(a);
  const colors = [...new Set((a.variants || []).map(v => v.color).filter(Boolean))];
  const colorDots = colors.slice(0, 4).map(c =>
    '<span class="card-color-dot" style="background:' + (COLOR_CSS[c] || '#ccc') + '" title="' + esc(c) + '"></span>'
  ).join('');
  const moreColors = colors.length > 4 ? '<span class="card-color-hint">+' + (colors.length - 4) + ' more</span>' : '';

  return '<div class="prod" onclick="openDetail(\'' + jq(a.id) + '\')">' +
    '<div class="photo-wrap" id="pw-' + a.id + '">' + photoWrapHTML(a) + '</div>' +
    '<div class="prod-info">' +
      '<div class="pname">' + esc(a.name || a.article_code) + '</div>' +
      '<div class="pdesc">' + esc(a.description || a.article_code) + '</div>' +
      (SHOW_PRICES && minPrice ? '<div class="card-price">' + esc(CUR) + ' ' + minPrice + '/pc</div>' : '') +
    '</div>' +
    '<button class="btn-atc" onclick="event.stopPropagation();quickAddToCart(\'' + jq(a.id) + '\')">ADD TO CART</button>' +
  '</div>';
}

// Quick-add: opens modal if selection needed, else adds directly
function quickAddToCart(aid) {
  const a = DATA.articles.find(x => x.id === aid);
  if (!a) return;
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const sel = SELECTION[aid] || {};
  // if only one color and no sizes, add directly
  const colVars = a.variants.filter(v => v.color === (colors[0] || ''));
  const hasSizes = colVars.some(v => v.size && v.size.trim());
  if (colors.length === 1 && !hasSizes) {
    if (!SELECTION[aid]) SELECTION[aid] = { color: colors[0], qty: 1 };
    addToCart(aid); // adds silently (toast + badge update) — no interrupting drawer
  } else {
    openDetail(aid); // needs a colour/size choice — take them to the product page
  }
}

// Photo nav (card)
function prevPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const p = cardPhotos(a); if (!p.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + p.length) % p.length;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}
function nextPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const p = cardPhotos(a); if (!p.length) return;
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % p.length;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}
function goPhoto(aid, idx) {
  PHOTO_IDX[aid] = idx;
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}

// ── Product page navigation ──
function openDetail(aid) {
  saveCartToStorage();
  window.location.href = '/product.html?id=' + encodeURIComponent(aid) + '&t=' + encodeURIComponent(TOKEN);
}
function closeDetail() {
  document.getElementById('prodModal').classList.remove('open');
  document.body.style.overflow = '';
  MODAL_AID = null;
}

// ── localStorage cart persistence ──
function saveCartToStorage() {
  try { localStorage.setItem('bag_cart_' + TOKEN, JSON.stringify(CART)); } catch(e) {}
}
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('bag_cart_' + TOKEN);
    Object.keys(CART).forEach(k => delete CART[k]); // full resync, not merge — see pageshow handler below
    if (raw) Object.assign(CART, JSON.parse(raw));
  } catch(e) {}
}
// Mobile back gestures/buttons often restore the page from the browser's
// back-forward cache (bfcache) instead of reloading it — init() never re-runs,
// so an item added on another page (e.g. the product page) never shows up
// here unless we explicitly resync the in-memory cart from storage.
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  loadCartFromStorage();
  renderNav();
  renderCart();
  if (VIEW === 'catalogue') renderCataloguePage(); else renderHomepage();
});
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
  const a = DATA.articles.find(x => x.id === aid);
  const avail = a ? a.variants.filter(v => v.color === color && v.available_qty > 0) : [];
  if (FILTER.size && avail.find(v => v.size === FILTER.size)) SELECTION[aid].size = FILTER.size;
  else if (avail.length === 1) SELECTION[aid].size = avail[0].size;
  else SELECTION[aid].size = null;
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
  if (max != null && q > max) { q = max; toast('Only ' + max + ' in stock'); }
  SELECTION[aid].qty = q;
  const inp = document.querySelector('#prodModal .modal-qty-input');
  if (inp) inp.value = q;
}

function detailHTML(a) {
  const colors = [...new Set(a.variants.map(v => v.color).filter(Boolean))];
  const sel = SELECTION[a.id] || {};
  const selColor = sel.color || colors[0] || '';
  const selSize  = sel.size || null;
  const colVars  = a.variants.filter(v => v.color === selColor);

  const showPhotos = resolvePhotos(a, selColor);
  const idx = Math.min(PHOTO_IDX[a.id] || 0, Math.max(0, showPhotos.length - 1));

  // Resolve display price
  let displayPrice = null;
  if (selSize) {
    const sv = colVars.find(v => v.size === selSize);
    if (sv) displayPrice = sv.price ?? a.base_price;
  }
  if (displayPrice == null) colVars.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (displayPrice == null || p < displayPrice)) displayPrice = p; });
  if (displayPrice == null) a.variants.forEach(v => { const p = v.price ?? a.base_price; if (p != null && (displayPrice == null || p < displayPrice)) displayPrice = p; });

  // Photo area
  const bigImg = showPhotos.length
    ? '<img src="' + esc(showPhotos[idx].url) + '" alt="" class="modal-big-img">'
    : '<div class="no-photo" style="height:220px">No photo</div>';
  const thumbs = showPhotos.length > 1
    ? '<div class="modal-thumbs">' + showPhotos.map((p, i) =>
        '<img src="' + esc(p.url) + '" class="modal-ptb' + (i === idx ? ' on' : '') + '" onclick="goModalPhoto(\'' + jq(a.id) + '\',' + i + ')" loading="lazy">'
      ).join('') + '</div>' : '';

  // Stock info
  const totalAvail = colVars.reduce((n, v) => n + (v.available_qty || 0), 0);
  const inStock = totalAvail > 0;
  const stockRow =
    '<div class="modal-stock-row">' +
      '<div class="modal-stock-dot' + (inStock ? '' : ' out') + '"></div>' +
      '<span class="modal-stock-text' + (inStock ? '' : ' out') + '">' + (inStock ? 'In Stock' : 'Out of Stock') + '</span>' +
      (inStock && totalAvail < 20 ? '<span class="modal-stock-low">— Only ' + totalAvail + ' left</span>' : '') +
    '</div>';

  // Colour section
  let colourSection = '';
  if (colors.length > 1) {
    colourSection =
      '<div class="colour-section">' +
        '<div class="colour-section-label">Colour: <strong>' + esc(selColor) + '</strong></div>' +
        '<div class="colour-swatches">' +
          colors.map(c =>
            '<button class="colour-swatch-btn' + (c === selColor ? ' on' : '') + '"' +
            ' style="background:' + (COLOR_CSS[c] || '#ccc') + '"' +
            ' onclick="selectColor(\'' + jq(a.id) + '\',\'' + jq(c) + '\')"' +
            ' title="' + esc(c) + '"></button>'
          ).join('') +
        '</div>' +
      '</div>';
  } else if (colors.length === 1) {
    colourSection =
      '<div class="colour-section">' +
        '<div class="colour-section-label">Colour: <strong>' + esc(selColor) + '</strong></div>' +
        '<div class="colour-single-row">' +
          '<div class="colour-single-swatch" style="background:' + (COLOR_CSS[selColor] || '#ccc') + '"></div>' +
          '<span class="colour-single-name">' + esc(selColor) + '</span>' +
        '</div>' +
      '</div>';
  }

  // Size section
  const hasSizes = colVars.some(v => v.size && v.size.trim());
  let sizeSection = '';
  if (hasSizes) {
    sizeSection =
      '<div class="size-section">' +
        '<div class="size-section-label">Size' + (selSize ? ': <strong>' + esc(selSize) + '</strong>' : '') + '</div>' +
        '<div class="size-chips-row">' +
          colVars.map(v => {
            const avail = v.available_qty || 0;
            const sub = avail === 0 ? 'Sold out' : avail < 10 ? 'Only ' + avail + ' left' : 'In stock';
            return '<button class="size-chip-new' + (v.size === selSize ? ' on' : '') + (avail === 0 ? ' disabled' : '') + '"' +
              (avail > 0 ? ' onclick="selectSize(\'' + jq(a.id) + '\',\'' + jq(v.size) + '\')"' : ' disabled') + '>' +
              '<span class="size-chip-name">' + esc(v.size || '—') + '</span>' +
              '<span class="size-chip-sub">' + sub + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  // Add to cart section
  const canAdd = selSize || !hasSizes;
  let addContent = '';
  if (canAdd) {
    const sv = hasSizes
      ? colVars.find(v => v.size === selSize)
      : colVars.find(v => v.available_qty > 0) || colVars[0];
    if (sv && sv.available_qty > 0) {
      const svPrice = sv.price ?? a.base_price;
      const qty = sel.qty || 1;
      const inCart = CART[sv.id] ? CART[sv.id].qty : 0;
      addContent =
        '<div class="qty-section">' +
          '<span class="qty-label">Qty</span>' +
          '<div class="stepper">' +
            '<button onclick="modalChg(\'' + jq(a.id) + '\',-1)">−</button>' +
            '<input type="number" class="modal-qty-input" min="1" max="' + sv.available_qty + '" value="' + qty + '" onchange="setModalQty(\'' + jq(a.id) + '\',this.value,' + sv.available_qty + ')">' +
            '<button onclick="modalChg(\'' + jq(a.id) + '\',1)">+</button>' +
          '</div>' +
        '</div>' +
        '<button class="btn-add-to-cart-full" onclick="addToCart(\'' + jq(a.id) + '\')">' +
          'ADD TO CART' +
          (SHOW_PRICES && svPrice != null ? ' — ' + esc(CUR) + ' ' + (svPrice * qty) : '') +
        '</button>' +
        (inCart ? '<div class="modal-in-cart">' + IC_OK + ' ' + inCart + ' pc already in your cart</div>' : '');
    } else if (sv) {
      addContent = '<div style="padding:14px 0;color:var(--danger);font-weight:700;font-size:14px">Out of stock</div>';
    }
  } else {
    addContent = '<div style="padding:14px 0;color:var(--muted);font-size:13px">← Select a size to continue</div>';
  }

  // Sticky bottom bar
  const sv2 = hasSizes ? colVars.find(v => v.size === selSize) : (colVars.find(v => v.available_qty > 0) || colVars[0]);
  const stickyPriceVal = (sv2 && SHOW_PRICES) ? (sv2.price ?? a.base_price) : null;
  const stickyBar =
    '<div class="modal-sticky-bar">' +
      '<div class="modal-sticky-info">' +
        '<div class="modal-sticky-name">' + esc(a.name || a.article_code) + '</div>' +
        '<div class="modal-sticky-sub">' +
          (selSize ? esc(selSize) + (stickyPriceVal != null ? ' · ' : '') : '') +
          (stickyPriceVal != null ? esc(CUR) + ' ' + stickyPriceVal : '') +
        '</div>' +
      '</div>' +
      (selColor ? '<div class="modal-sticky-swatch" style="background:' + (COLOR_CSS[selColor] || '#ccc') + '"></div>' : '') +
      '<button class="modal-sticky-btn" onclick="addToCart(\'' + jq(a.id) + '\')">ADD TO CART</button>' +
    '</div>';

  const photoSide =
    '<div class="modal-photo-side">' +
      '<div class="modal-photo-area">' +
        (showPhotos.length > 1 ? '<button class="slide-btn prev" onclick="prevDPhoto(\'' + jq(a.id) + '\')">&#8249;</button>' : '') +
        bigImg +
        (showPhotos.length > 1 ? '<button class="slide-btn next" onclick="nextDPhoto(\'' + jq(a.id) + '\')">&#8250;</button>' : '') +
      '</div>' +
      thumbs +
    '</div>';

  const infoSide =
    '<div class="modal-info-side">' +
      '<div class="modal-info">' +
        '<div class="modal-brand-tag">' + esc(DATA.shop.name || '') + '</div>' +
        '<div class="modal-product-title">' + esc(a.name || '') + '</div>' +
        '<div class="modal-product-sub">' + esc(a.article_code) + (a.category ? ' · ' + esc(a.category) : '') + '</div>' +
        stockRow +
        (SHOW_PRICES && displayPrice != null
          ? '<div class="modal-divider" style="margin:12px 0"></div>' +
            '<div class="modal-price-label">Price (per piece · wholesale)</div>' +
            '<div class="modal-price-big">' + esc(CUR) + ' ' + displayPrice + '</div>'
          : '') +
        (a.description ? '<p class="desc-text">' + esc(a.description) + '</p>' : '') +
        '<div class="modal-divider"></div>' +
        colourSection +
        sizeSection +
        addContent +
      '</div>' +
      stickyBar +
    '</div>';

  return '<div class="modal-layout">' + photoSide + infoSide + '</div>';
}

// Photo nav (modal)
function prevDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const p = modalPhotos(a);
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) - 1 + p.length) % p.length;
  refreshModal();
}
function nextDPhoto(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const p = modalPhotos(a);
  PHOTO_IDX[aid] = ((PHOTO_IDX[aid] || 0) + 1) % p.length;
  refreshModal();
}
function goModalPhoto(aid, idx) { PHOTO_IDX[aid] = idx; refreshModal(); }
function modalPhotos(a) {
  return resolvePhotos(a, (SELECTION[a.id] || {}).color || '');
}

// ── Add to cart ──
function addToCart(aid) {
  const a = DATA.articles.find(x => x.id === aid); if (!a) return;
  const sel = SELECTION[aid] || {};
  if (!sel.color) return toast('Please select a colour');
  const colVars = a.variants.filter(x => x.color === sel.color);
  const hasSizes = colVars.some(x => x.size && x.size.trim());
  if (hasSizes && !sel.size) return toast('Please select a size');
  const v = hasSizes
    ? a.variants.find(x => x.color === sel.color && x.size === sel.size)
    : colVars.find(x => x.available_qty > 0) || colVars[0];
  if (!v || v.available_qty <= 0) return toast('Out of stock');
  const qty = sel.qty || 1;
  const price = v.price != null ? v.price : a.base_price;
  const label = a.article_code + ' ' + sel.color + (v.size ? ' ' + v.size : '');
  if (CART[v.id]) CART[v.id].qty = Math.min(CART[v.id].qty + qty, v.available_qty);
  else CART[v.id] = { qty, label, price };
  SELECTION[aid].qty = 1;
  saveCartToStorage();
  cartAddedToast(label);
  renderCart();
  refreshModal();
  const el = document.getElementById('pw-' + aid); if (el) el.innerHTML = photoWrapHTML(a);
}

// ── Cart ──
function renderCart() {
  const ids = Object.keys(CART);
  const count = ids.reduce((n, id) => n + CART[id].qty, 0);
  // nav badge (mobile + desktop)
  const badge = document.getElementById('navCartBadge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
  const badgeD = document.getElementById('navdCartBadge');
  if (badgeD) { badgeD.textContent = count; badgeD.style.display = count ? 'flex' : 'none'; }
  const emptyBtn = document.getElementById('cartEmptyBtn');
  if (emptyBtn) emptyBtn.style.display = ids.length ? 'inline' : 'none';
  let total = 0;
  document.getElementById('cartLines').innerHTML = ids.map((id) => {
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

function cartLineHTML(id, c) {
  const jid = jq(id);
  const cv = cartVariant(id);
  // Variant no longer in the catalogue → minimal fallback line.
  if (!cv) {
    return '<div class="citem"><div class="citem-body"><div class="citem-top">' +
      '<div class="citem-name">' + esc(c.label || 'Item') + ' <span class="muted">× ' + c.qty + '</span></div>' +
      '<button class="citem-x" onclick="removeItem(\'' + jid + '\')">✕</button>' +
    '</div></div></div>';
  }
  const a = cv.a, v = cv.v;
  const img = resolvePhotos(a, v.color)[0].url;
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
  saveCartToStorage();
  renderCart();
}

// Move a cart line to a different variant of the SAME article (colour/size change),
// carrying the quantity over (capped at the new variant's stock, merged if already in cart).
function moveCartVariant(oldId, nv, a) {
  if (!nv || nv.id === oldId) return;
  const oldQty = (CART[oldId] && CART[oldId].qty) || 1;
  const price = nv.price != null ? nv.price : a.base_price;
  const label = a.article_code + ' ' + nv.color + (nv.size ? ' ' + nv.size : '');
  const want = Math.min(oldQty, nv.available_qty || 1) || 1;
  if (CART[nv.id]) CART[nv.id].qty = Math.min(CART[nv.id].qty + want, nv.available_qty || want);
  else CART[nv.id] = { qty: want, label, price };
  delete CART[oldId];
  saveCartToStorage();
  renderCart();
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
  openDetail(cv.a.id);
}

function removeItem(id) {
  delete CART[id];
  saveCartToStorage();
  renderCart();
  if (DATA) {
    const a = DATA.articles.find(x => (x.variants || []).some(v => v.id === id));
    if (a) { const el = document.getElementById('pw-' + a.id); if (el) el.innerHTML = photoWrapHTML(a); }
  }
}
function openCart()  { document.getElementById('drawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeCart() { document.getElementById('drawer').classList.remove('open'); document.body.style.overflow = ''; }

function emptyCart() {
  if (!Object.keys(CART).length) return;
  if (!confirm('Remove all items from your cart?')) return;
  Object.keys(CART).forEach(id => delete CART[id]);
  saveCartToStorage();
  renderCart();
  refreshModal();
  if (DATA) DATA.articles.forEach(a => { const el = document.getElementById('pw-' + a.id); if (el) el.innerHTML = photoWrapHTML(a); });
}

// ── Order history (customer's own past purchases, by phone number on their link) ──
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

async function sendOrder() {
  const items = Object.keys(CART).map((id) => ({ variant_id: id, qty: CART[id].qty }));
  if (!items.length) return toast('Cart is empty');
  const { ok, status, data } = await api('/api/order', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, items }),
  });
  if (status === 403) return showExpired();
  if (ok && data && data.whatsapp) window.location.href = data.whatsapp;
  else toast('Could not send. Please try again.');
}

// ── Swipe ──
function initCardSwipe() {
  const grid = document.getElementById('grid');
  if (!grid || grid._sw) return;
  grid._sw = true;
  let sx = 0, swAid = null, didSwipe = false;
  grid.addEventListener('touchstart', e => {
    const pw = e.target.closest('[id^="pw-"]');
    didSwipe = false;
    if (pw) { sx = e.touches[0].clientX; swAid = pw.id.slice(3); } else swAid = null;
  }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (!swAid) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) { didSwipe = true; if (dx < 0) nextPhoto(swAid); else prevPhoto(swAid); }
    swAid = null;
  }, { passive: true });
  grid.addEventListener('click', e => { if (didSwipe) { e.stopPropagation(); didSwipe = false; } }, true);
}
function attachModalSwipe() {
  const area = document.querySelector('#prodModal .modal-photo-area');
  if (!area || area._sw) return;
  area._sw = true;
  let sx = 0;
  area.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  area.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40 && MODAL_AID) { if (dx < 0) nextDPhoto(MODAL_AID); else prevDPhoto(MODAL_AID); }
  }, { passive: true });
}

// ── Click outside handlers ──
function onDocClick(e) {
  if (SORT_OPEN && !e.target.closest('.sort-wrap')) {
    SORT_OPEN = false;
    const dd = document.querySelector('.sort-dropdown');
    if (dd) dd.classList.remove('open');
  }
  if (!e.target.closest('.desktop-dropdown') && !e.target.closest('.nav-cat-link')) {
    closeDesktopDropdown();
  }
}

// ── Utils ──
function jq(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ── Start ──
init();
