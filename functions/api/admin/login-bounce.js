// CF Access protects /api/admin/* so visiting this URL triggers the CF Access login page.
// After the user authenticates, CF Access redirects back here, and we bounce to admin.html
// with a valid session cookie already set.
export async function onRequest() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin.html" },
  });
}
