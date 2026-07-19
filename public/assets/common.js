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

// ── Shared footer (catalogue + product pages) ──
const IC_IG = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
const IC_FB = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>';
// Reads the page's own `DATA.shop` global (set independently by catalog.js and
// product.js) — resolved at call time, not definition time, so this one copy
// works on both pages without either needing its own duplicate.
function footerHTML() {
  const shop = (typeof DATA !== "undefined" && DATA && DATA.shop) || {};
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
