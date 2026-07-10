import { json, isAdmin } from '../_util.js';

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
  return json({ ok: true });
}
