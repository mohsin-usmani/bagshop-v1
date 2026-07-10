import { json } from "../_util.js";

// This endpoint is protected by _middleware.js (auth checked before we get here).
// Visit /api/admin/status in the browser to see auth + DB state at a glance.
export async function onRequest(context) {
  const { env } = context;
  const [art, vari] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as n FROM articles").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM variants").first(),
  ]);
  return json({
    auth: "ok",
    dev_mode: env.DEV === "1",
    articles_in_db: art ? art.n : "db-error",
    variants_in_db: vari ? vari.n : "db-error",
  });
}
