import { json, isAdmin } from '../_util.js';

function parseVariants(json_str) {
  if (!json_str) return {};
  try { return JSON.parse(json_str) || {}; } catch (e) { return {}; }
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!isAdmin(context)) return json({ error: 'auth' }, 403);
  const { results } = await env.DB.prepare(
    "SELECT category as name, COUNT(*) as article_count FROM articles WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY category"
  ).all();
  // Merge with any extra categories stored in settings (created but empty)
  const extra = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  const storedCats = extra && extra.value ? extra.value.split(',').filter(Boolean) : [];
  const map = {};
  results.forEach(r => { map[r.name] = r.article_count; });
  storedCats.forEach(c => { if (!(c in map)) map[c] = 0; });
  const categories = Object.entries(map)
    .map(([name, article_count]) => ({ name, article_count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return json({ categories });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: 'auth' }, 403);
  const { name } = await request.json();
  if (!name || !name.trim()) return json({ error: 'Name required' }, 400);
  const trimmed = name.trim();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  const cats = existing && existing.value ? existing.value.split(',').filter(Boolean) : [];
  if (!cats.includes(trimmed)) cats.push(trimmed);
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('category_list', ?)").bind(cats.join(',')).run();
  return json({ ok: true });
}

export async function onRequestPatch(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: 'auth' }, 403);
  const { old_name, new_name } = await request.json();
  if (!old_name || !new_name || !new_name.trim()) return json({ error: 'old_name and new_name required' }, 400);
  const trimmed = new_name.trim();
  await env.DB.prepare("UPDATE articles SET category=? WHERE category=?").bind(trimmed, old_name).run();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  if (existing && existing.value) {
    const cats = existing.value.split(',').map(c => c === old_name ? trimmed : c);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='category_list'").bind(cats.join(',')).run();
  }
  // Keep the header menu selection in sync with the rename.
  const nav = await env.DB.prepare("SELECT value FROM settings WHERE key='nav_categories'").first();
  if (nav && nav.value) {
    const navCats = nav.value.split(',').map(c => c.trim() === old_name ? trimmed : c);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='nav_categories'").bind(navCats.join(',')).run();
  }
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  if (!isAdmin(context)) return json({ error: 'auth' }, 403);
  const { name } = await request.json();
  if (!name) return json({ error: 'name required' }, 400);
  await env.DB.prepare("UPDATE articles SET category='Uncategorized' WHERE category=?").bind(name).run();
  const existing = await env.DB.prepare("SELECT value FROM settings WHERE key='category_list'").first();
  if (existing && existing.value) {
    const cats = existing.value.split(',').filter(c => c !== name);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='category_list'").bind(cats.join(',')).run();
  }
  // Remove the deleted category from the header menu too.
  const nav = await env.DB.prepare("SELECT value FROM settings WHERE key='nav_categories'").first();
  if (nav && nav.value) {
    const navCats = nav.value.split(',').filter(c => c.trim() !== name);
    await env.DB.prepare("UPDATE settings SET value=? WHERE key='nav_categories'").bind(navCats.join(',')).run();
  }
  // Clean up this category's header photos (left/right + every per-target
  // crop) from R2 too, or they're orphaned in the bucket with no way to
  // reclaim the storage once the category_images row is gone.
  const imgRow = await env.DB.prepare(
    "SELECT left_image_key, right_image_key, left_variants_json, right_variants_json FROM category_images WHERE category=?"
  ).bind(name).first();
  if (imgRow) {
    if (imgRow.left_image_key) { try { await env.BUCKET.delete(imgRow.left_image_key); } catch (e) {} }
    if (imgRow.right_image_key) { try { await env.BUCKET.delete(imgRow.right_image_key); } catch (e) {} }
    for (const v of Object.values(parseVariants(imgRow.left_variants_json))) { if (v && v.key) { try { await env.BUCKET.delete(v.key); } catch (e) {} } }
    for (const v of Object.values(parseVariants(imgRow.right_variants_json))) { if (v && v.key) { try { await env.BUCKET.delete(v.key); } catch (e) {} } }
  }
  await env.DB.prepare("DELETE FROM category_images WHERE category=?").bind(name).run();
  return json({ ok: true });
}
