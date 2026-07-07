// GET /api/img/<key...>  — streams a photo from R2
export async function onRequestGet(context) {
  const { params, env } = context;
  const key = Array.isArray(params.path) ? params.path.join("/") : params.path;
  if (!key) return new Response("not found", { status: 404 });

  const obj = await env.BUCKET.get(key);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
}
