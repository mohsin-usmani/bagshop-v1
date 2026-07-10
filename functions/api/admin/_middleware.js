import { json, checkAdmin } from "../_util.js";

export async function onRequest(context) {
  const check = checkAdmin(context);
  if (!check.ok) {
    return json({ error: "auth", reason: check.reason, email: check.email || null }, 401);
  }
  return context.next();
}
