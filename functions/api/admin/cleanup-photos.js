import { json, isAdmin } from "../_util.js";

// Maintenance tool: finds R2 objects under articles/ (product photos) that
// aren't referenced by any row in the photos table anymore — orphaned by
// product deletions that predate the R2-cleanup fix in articles.js DELETE.
// GET            -> dry run, lists what's orphaned without touching anything
// GET ?delete=1  -> actually deletes the orphaned objects
export async function onRequestGet(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: "auth" }, 401);
  const url = new URL(request.url);
  const doDelete = url.searchParams.get("delete") === "1";

  const photoRows = (await env.DB.prepare("SELECT url FROM photos").all()).results || [];
  const referenced = new Set();
  for (const p of photoRows) {
    if (p.url && p.url.startsWith("/api/img/")) referenced.add(p.url.replace("/api/img/", ""));
  }

  let cursor;
  const allObjects = [];
  do {
    const page = await env.BUCKET.list({ prefix: "articles/", cursor, limit: 1000 });
    for (const obj of page.objects) allObjects.push({ key: obj.key, size: obj.size });
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const orphaned = allObjects.filter((o) => !referenced.has(o.key));
  const orphanedSizeBytes = orphaned.reduce((s, o) => s + o.size, 0);

  let deletedCount = 0;
  if (doDelete) {
    for (const o of orphaned) {
      try { await env.BUCKET.delete(o.key); deletedCount++; } catch (e) {}
    }
  }

  return json({
    totalInBucket: allObjects.length,
    totalReferencedInDb: referenced.size,
    orphanedCount: orphaned.length,
    orphanedSizeBytes,
    orphanedSizeMB: Math.round((orphanedSizeBytes / 1024 / 1024) * 100) / 100,
    orphanedKeys: orphaned.map((o) => o.key),
    deleted: doDelete ? deletedCount : null,
  });
}
