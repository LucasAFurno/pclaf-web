import "@supabase/functions-js/edge-runtime.d.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const turnstileSecret = Deno.env.get("TURNSTILE_SECRET") || "";
const passwordHash = Deno.env.get("ADMIN_PASSWORD_SHA256") || "";
const rateSalt = Deno.env.get("ADMIN_LOGIN_RATE_SALT") || "";
const allowedHostnames = (Deno.env.get("ADMIN_TURNSTILE_HOSTNAMES") || "www.pclaf.com.ar,pclaf.com.ar")
  .split(",").map((value) => value.trim()).filter(Boolean);
const maxAttempts = 3;
const lockMinutes = 15;
const adminEmail = "lucas_yenkoz28@hotmail.com";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = new Set(["https://www.pclaf.com.ar", "https://pclaf.com.ar", "http://127.0.0.1:4173", "http://localhost:4173"]);
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.pclaf.com.ar",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

function clientIp(req: Request) {
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 100);
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`Database error ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function verifyTurnstile(token: string, remoteip: string) {
  const form = new FormData();
  form.set("secret", turnstileSecret);
  form.set("response", token);
  form.set("remoteip", remoteip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return { success: false };
  return await response.json() as { success?: boolean; action?: string; hostname?: string };
}

async function authAdmin(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Auth admin error ${response.status}`);
  return body;
}

// La contraseña que acaba de superar el hash histórico se registra también en
// Supabase Auth. Así el navegador recibe un JWT real para las políticas RLS sin
// obligar al administrador a cambiar su contraseña conocida.
async function syncAdminPassword(password: string) {
  const list = await authAdmin("users?per_page=1000");
  const user = Array.isArray(list?.users)
    ? list.users.find((candidate: { email?: string }) => candidate.email?.toLowerCase() === adminEmail)
    : null;
  if (user?.id) {
    await authAdmin(`users/${user.id}`, { method: "PUT", body: JSON.stringify({ password, email_confirm: true }) });
    return;
  }
  await authAdmin("users", { method: "POST", body: JSON.stringify({ email: adminEmail, password, email_confirm: true }) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey || !turnstileSecret || !passwordHash || !rateSalt) return reply(req, { ok: false, error: "login_not_configured" }, 503);

  try {
    const payload = await req.json();
    const password = String(payload?.password || "").slice(0, 512);
    const turnstileToken = String(payload?.turnstileToken || "").slice(0, 4096);
    if (!password || !turnstileToken) return reply(req, { ok: false, error: "verification_required" }, 400);

    const ip = clientIp(req);
    const ipHash = await sha256(`${rateSalt}:${ip}`);
    const records = await db(`admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}&select=failed_attempts,locked_until`);
    const record = records?.[0] || null;
    const now = Date.now();
    if (record?.locked_until && new Date(record.locked_until).getTime() > now) return reply(req, { ok: false, error: "temporarily_locked", lockedUntil: record.locked_until }, 429);

    const verification = await verifyTurnstile(turnstileToken, ip);
    if (!verification.success || verification.action !== "pclaf_admin_login" || !allowedHostnames.includes(verification.hostname || "")) return reply(req, { ok: false, error: "verification_failed" }, 403);

    if (await sha256(password) === passwordHash) {
      if (record) await db(`admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}`, { method: "DELETE" });
      await syncAdminPassword(password);
      return reply(req, { ok: true });
    }

    const failedAttempts = Number(record?.failed_attempts || 0) + 1;
    const lockedUntil = failedAttempts >= maxAttempts ? new Date(now + lockMinutes * 60_000).toISOString() : null;
    const values = { ip_hash: ipHash, failed_attempts: failedAttempts, locked_until: lockedUntil, updated_at: new Date().toISOString() };
    await db(record ? `admin_login_attempts?ip_hash=eq.${encodeURIComponent(ipHash)}` : "admin_login_attempts", { method: record ? "PATCH" : "POST", body: JSON.stringify(values) });
    return reply(req, { ok: false, error: lockedUntil ? "temporarily_locked" : "invalid_credentials", remaining: Math.max(0, maxAttempts - failedAttempts), lockedUntil }, lockedUntil ? 429 : 401);
  } catch (error) {
    console.error("admin-login failure", error instanceof Error ? error.message : "unknown");
    return reply(req, { ok: false, error: "login_unavailable" }, 500);
  }
});
