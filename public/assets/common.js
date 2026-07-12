// Small shared helpers used by catalog.js and admin.js

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

async function api(path, opts) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20000); // 20 s hard timeout
  let res;
  try {
    res = await fetch(path, { signal: ctrl.signal, ...opts });
    clearTimeout(tid);
  } catch (err) {
    clearTimeout(tid);
    if (err && err.name === "AbortError") {
      // Timed out — surface as a generic null-data response so callers show error state
      return { ok: false, status: 0, data: null };
    }
    // CF Access redirected the fetch to cloudflareaccess.com (cross-origin CORS failure)
    const d = { error: "auth", reason: "cf_redirect" };
    window.dispatchEvent(new CustomEvent("apiauthfail", { detail: d }));
    return { ok: false, status: 0, data: d };
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  // CF Access can also return an HTML login page (same-origin 200) instead of JSON
  if (!data && (res.headers.get("content-type") || "").includes("text/html")) {
    data = { error: "auth", reason: "cf_redirect" };
    window.dispatchEvent(new CustomEvent("apiauthfail", { detail: data }));
  }
  return { ok: res.ok, status: res.status, data };
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1800);
}

// Myntra-style "Added to cart" confirmation — pops near the cart icon,
// stays a few seconds, then fades. Replaces the old always-on bottom bar so
// the cart icon + badge in the header is the only permanent cart affordance.
function cartAddedToast(label) {
  let el = document.querySelector(".cart-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "cart-toast";
    el.innerHTML = '<span class="cart-toast-icon">✓</span><span class="cart-toast-text"></span>';
    document.body.appendChild(el);
  }
  el.querySelector(".cart-toast-text").textContent = label ? "Added to cart — " + label : "Added to cart";
  el.classList.remove("show");
  void el.offsetWidth; // restart the animation if a toast is already showing
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4500);
}

// ── Branding (admin-uploaded logo + favicon) ──
function setFavicon(href) {
  if (!href) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
  link.type = /\.svg(\?|$)/i.test(href) ? "image/svg+xml" : "image/png";
  link.href = href;
}
// Swap the inline SVG wordmark(s) for the uploaded logo image (keeps their height).
function applyHeaderLogo(shop) {
  if (!shop || !shop.logo_url) return;
  document.querySelectorAll(".nav-logo-svg, img.nav-logo-img").forEach((el) => {
    if (el.tagName.toLowerCase() === "img") { el.src = shop.logo_url; return; }
    const img = document.createElement("img");
    img.src = shop.logo_url;
    img.alt = shop.name || "Logo";
    img.className = "nav-logo-img";
    const st = el.getAttribute("style") || "";
    const m = st.match(/height:\s*([^;]+)/);
    if (m) img.style.height = m[1].trim();
    el.replaceWith(img);
  });
}
function applyBranding(shop) {
  if (!shop) return;
  setFavicon(shop.favicon_url);
  applyHeaderLogo(shop);
}

// Resize/compress an image File in the browser to keep storage tiny + catalogue fast.
function compressImage(file, maxEdge = 1000, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })),
        "image/jpeg", quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}
