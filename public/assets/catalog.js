const TOKEN = qs("t");
let DATA = null;
let CUR = "Rs.";
let SHOW_PRICES = true;
const FILTER = { category: "", color: "", size: "", q: "" };
const CART = {}; // variant_id -> { qty, label, price }

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

  // filter chips
  const catRow = document.getElementById("catRow");
  catRow.innerHTML = '<span class="pill ' + (FILTER.category === "" ? "on" : "") + '" onclick="setF(\'category\',\'\')">All types</span>' +
    f.categories.map((c) => '<span class="pill ' + (FILTER.category === c ? "on" : "") + '" onclick="setF(\'category\',' + jq(c) + ')">' + esc(c) + '</span>').join("");

  const cvRow = document.getElementById("cvRow");
  cvRow.innerHTML =
    '<select onchange="setF(\'color\',this.value)" style="max-width:160px"><option value="">All colours</option>' +
      f.colors.map((c) => '<option ' + (FILTER.color === c ? "selected" : "") + '>' + esc(c) + '</option>').join("") + '</select>' +
    '<select onchange="setF(\'size\',this.value)" style="max-width:150px"><option value="">All sizes</option>' +
      f.sizes.map((s) => '<option ' + (FILTER.size === s ? "selected" : "") + '>' + esc(s) + '</option>').join("") + '</select>';

  // grid
  const grid = document.getElementById("grid");
  if (!DATA.articles.length) {
    grid.innerHTML = '<p class="muted">No items match. Try clearing filters.</p>';
  } else {
    grid.innerHTML = DATA.articles.map(articleCard).join("");
  }
  renderCart();
}

function articleCard(a) {
  const photo = a.photos && a.photos[0] ? '<img src="' + esc(a.photos[0].url) + '" alt="">' : 'Photo';
  const vs = a.variants.map((v) => {
    const price = (v.price != null ? v.price : a.base_price);
    const priceHtml = SHOW_PRICES && price != null ? '<span class="price">' + esc(CUR) + esc(price) + '/pc</span>' : '';
    const inCart = CART[v.id] ? CART[v.id].qty : 0;
    return '<div class="vrow">' +
        '<div class="vmeta"><strong>' + esc(v.color || "") + '</strong> ' + (v.size ? '· ' + esc(v.size) : '') +
        '<br><span class="muted" style="font-size:12px">In stock: ' + esc(v.available_qty) + '</span> ' + priceHtml + '</div>' +
        stepper(v, a, price, inCart) +
      '</div>';
  }).join("");
  return '<div class="card prod"><div class="head">' +
      '<div class="thumb">' + photo + '</div>' +
      '<div><div class="code">' + esc(a.article_code) + '</div>' +
      '<div class="muted" style="font-size:13px">' + esc(a.name || "") + '</div>' +
      '<div class="tag" style="margin-top:4px">' + esc(a.category) + '</div></div>' +
    '</div><div class="vlist">' + vs + '</div></div>';
}

function stepper(v, a, price, qty) {
  const label = a.article_code + (v.color ? " " + v.color : "") + (v.size ? " " + v.size : "");
  const p = price != null ? price : 0;
  return '<div class="stepper" data-v="' + v.id + '">' +
    '<button onclick="chg(' + jq(v.id) + ',' + jq(label) + ',' + p + ',-10,' + v.available_qty + ')">−</button>' +
    '<input type="number" min="0" max="' + v.available_qty + '" value="' + qty + '" ' +
      'onchange="setQty(' + jq(v.id) + ',' + jq(label) + ',' + p + ',this.value,' + v.available_qty + ')">' +
    '<button onclick="chg(' + jq(v.id) + ',' + jq(label) + ',' + p + ',10,' + v.available_qty + ')">+</button></div>';
}

function setF(k, val) { FILTER[k] = val; load(); }

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
  // update the visible input
  const box = document.querySelector('.stepper[data-v="' + id + '"] input');
  if (box) box.value = q;
  renderCart();
}

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
    return '<div class="line"><div>' + esc(c.label) + ' <span class="muted">× ' + c.qty + '</span></div>' +
      (SHOW_PRICES ? '<div class="muted">' + esc(CUR) + (c.price * c.qty) + '</div>' : '') +
      '<span class="x" onclick="removeItem(' + jq(id) + ')">✕</span></div>';
  }).join("") || '<p class="muted">Cart is empty.</p>';
  document.getElementById("cartTotal").innerHTML = SHOW_PRICES && ids.length ? 'Indicative total: ' + esc(CUR) + total : '';
}
function removeItem(id) { delete CART[id]; renderCart(); render(); }

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

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function jq(s) { return JSON.stringify(String(s)); }

load();
