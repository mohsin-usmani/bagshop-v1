// Clean shareable link:  https://yourshop.com/s/<token>
// Redirects to the catalog page which reads ?t=
export async function onRequestGet(context) {
  const { params, request } = context;
  const t = params.token;
  const dest = new URL(`/s.html?t=${encodeURIComponent(t)}`, request.url).toString();
  return Response.redirect(dest, 302);
}
