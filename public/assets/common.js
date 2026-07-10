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
