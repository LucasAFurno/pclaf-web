const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://bcmfzgjpqfjnudhgraan.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
const ALERT_SECRET = Deno.env.get("PCLAF_ALERT_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pclaf-alert-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

function clean(value: unknown, maxLen = 240) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function todayBuenosAires() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function supa(path: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function countRows(table: string, filter = "") {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${filter}&limit=1`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (!response.ok) throw new Error(await response.text());
  const contentRange = response.headers.get("content-range") || "";
  return Number(contentRange.split("/")[1] || 0);
}

async function sendTelegram(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) throw new Error("Missing Telegram secrets");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}

function daysAgoIso(days: number) {
  const date = new Date(`${todayBuenosAires()}T12:00:00-03:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function personName(nombre: unknown, apellido: unknown) {
  return [clean(nombre, 60), clean(apellido, 60)].filter(Boolean).join(" ").trim() || "Sin nombre";
}

async function buildDailySummary() {
  const today = todayBuenosAires();
  const [
    espera,
    proceso,
    listo,
    urgentes,
    sinPresupuesto,
    turnosHoy,
    descuentos,
    listasViejas,
    esperaVieja,
  ] = await Promise.all([
    countRows("reparaciones", "&estado=eq.espera"),
    countRows("reparaciones", "&estado=eq.proceso"),
    countRows("reparaciones", "&estado=eq.listo"),
    countRows("reparaciones", "&urgente=eq.true&estado=neq.entregado&estado=neq.cancelado"),
    countRows("reparaciones", "&estado=neq.entregado&estado=neq.cancelado&presupuesto=is.null"),
    supa(`turnos?select=nombre,apellido,telefono,servicio,fecha,hora,estado,urgente&fecha=eq.${today}&estado=neq.cancelado&order=hora.asc&limit=8`),
    countRows("clientes", "&descuento_resena=eq.true"),
    supa(`reparaciones?select=numero,estado,equipos(nombre,clientes(nombre,apellido,telefono))&estado=eq.listo&created_at=lt.${daysAgoIso(3)}&order=numero.desc&limit=6`),
    supa(`reparaciones?select=numero,estado,equipos(nombre,clientes(nombre,apellido,telefono))&estado=eq.espera&created_at=lt.${daysAgoIso(7)}&order=numero.desc&limit=6`),
  ]);

  const lines = [
    "Resumen diario PCLAF",
    `Fecha: ${today}`,
    "",
    `En espera: ${espera}`,
    `En reparación: ${proceso}`,
    `Listas para retirar: ${listo}`,
    `Urgentes activos: ${urgentes}`,
    `Activas sin presupuesto: ${sinPresupuesto}`,
    `Clientes con descuento activo: ${descuentos}`,
    "",
    turnosHoy?.length ? `Turnos de hoy (${turnosHoy.length}):` : "No hay turnos para hoy.",
  ];

  (turnosHoy || []).forEach((t: Record<string, unknown>) => {
    const nombre = [clean(t.nombre, 60), clean(t.apellido, 60)].filter(Boolean).join(" ");
    lines.push(`- ${clean(t.hora, 20)}hs ${nombre || "Sin nombre"} - ${clean(t.servicio, 100)}${t.urgente ? " [URGENTE]" : ""}`);
  });

  if (listasViejas?.length) {
    lines.push("", "Listas hace +3 días:");
    listasViejas.forEach((r: Record<string, any>) => {
      const cliente = r.equipos?.clientes || {};
      const nombre = [clean(cliente.nombre, 50), clean(cliente.apellido, 50)].filter(Boolean).join(" ");
      lines.push(`- #${clean(r.numero, 20)} ${nombre || "Sin cliente"}`);
    });
  }

  if (esperaVieja?.length) {
    lines.push("", "En espera hace +7 días:");
    esperaVieja.forEach((r: Record<string, any>) => {
      const cliente = r.equipos?.clientes || {};
      const nombre = [clean(cliente.nombre, 50), clean(cliente.apellido, 50)].filter(Boolean).join(" ");
      lines.push(`- #${clean(r.numero, 20)} ${nombre || "Sin cliente"}`);
    });
  }

  lines.push("", "Tip: usá /pendientes, /hoy o /urgentes en el bot.");
  return lines.join("\n");
}

async function buildDailySummaryV2() {
  const today = todayBuenosAires();
  const tomorrow = addDays(today, 1);
  const [
    espera,
    proceso,
    listo,
    urgentes,
    sinPresupuesto,
    turnosHoy,
    descuentos,
    listasViejas,
    esperaVieja,
    turnosManana,
    turnosUrgentes,
  ] = await Promise.all([
    countRows("reparaciones", "&estado=eq.espera"),
    countRows("reparaciones", "&estado=eq.proceso"),
    countRows("reparaciones", "&estado=eq.listo"),
    countRows("reparaciones", "&urgente=eq.true&estado=neq.entregado&estado=neq.cancelado"),
    countRows("reparaciones", "&estado=neq.entregado&estado=neq.cancelado&presupuesto=is.null"),
    supa(`turnos?select=nombre,apellido,servicio,hora,urgente&fecha=eq.${today}&estado=neq.cancelado&order=hora.asc&limit=8`),
    countRows("clientes", "&descuento_resena=eq.true"),
    supa(`reparaciones?select=numero,equipos(clientes(nombre,apellido))&estado=eq.listo&created_at=lt.${daysAgoIso(3)}&order=numero.desc&limit=6`),
    supa(`reparaciones?select=numero,equipos(clientes(nombre,apellido))&estado=eq.espera&created_at=lt.${daysAgoIso(7)}&order=numero.desc&limit=6`),
    supa(`turnos?select=nombre,apellido,servicio,hora,urgente&fecha=eq.${tomorrow}&estado=neq.cancelado&order=hora.asc&limit=6`),
    supa(`turnos?select=nombre,apellido,servicio,fecha,hora&urgente=eq.true&estado=neq.cancelado&order=fecha.asc,hora.asc&limit=6`),
  ]);

  const lines = [
    "* Resumen diario PCLAF",
    "--------------------",
    `Fecha: ${today}`,
    "",
    `⏳ En espera: ${espera}`,
    `🔧 En reparación: ${proceso}`,
    `✅ Listas para retirar: ${listo}`,
    `🚨 Urgentes activos: ${urgentes}`,
    `💰 Activas sin presupuesto: ${sinPresupuesto}`,
    `🎁 Clientes con descuento activo: ${descuentos}`,
    "",
    turnosHoy?.length ? `📅 Turnos de hoy (${turnosHoy.length}):` : "📅 No hay turnos para hoy.",
  ];

  (turnosHoy || []).forEach((t: Record<string, unknown>) => {
    lines.push(`- ${clean(t.hora, 20)}hs ${personName(t.nombre, t.apellido)} - ${clean(t.servicio, 100)}${t.urgente ? " [URGENTE]" : ""}`);
  });

  if (turnosManana?.length) {
    lines.push("", `🗓️ Turnos de mañana (${turnosManana.length}):`);
    turnosManana.forEach((t: Record<string, unknown>) => {
      lines.push(`- ${clean(t.hora, 20)}hs ${personName(t.nombre, t.apellido)} - ${clean(t.servicio, 100)}${t.urgente ? " [URGENTE]" : ""}`);
    });
  }

  if (turnosUrgentes?.length) {
    lines.push("", "🚨 Próximos turnos urgentes:");
    turnosUrgentes.forEach((t: Record<string, unknown>) => {
      lines.push(`- ${clean(t.fecha, 20)} ${clean(t.hora, 20)}hs ${personName(t.nombre, t.apellido)} - ${clean(t.servicio, 100)}`);
    });
  }

  if (listasViejas?.length) {
    lines.push("", "⚠️ Listas hace +3 días:");
    listasViejas.forEach((r: Record<string, any>) => {
      const cliente = r.equipos?.clientes || {};
      lines.push(`- #${clean(r.numero, 20)} ${personName(cliente.nombre, cliente.apellido)}`);
    });
  }

  if (esperaVieja?.length) {
    lines.push("", "⚠️ En espera hace +7 días:");
    esperaVieja.forEach((r: Record<string, any>) => {
      const cliente = r.equipos?.clientes || {};
      lines.push(`- #${clean(r.numero, 20)} ${personName(cliente.nombre, cliente.apellido)}`);
    });
  }

  lines.push("", "Tip: probá 'que tengo para hoy', 'quien tiene descuento' o '/reparacion 3288' en el bot.");
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (ALERT_SECRET) {
      const incoming = req.headers.get("x-pclaf-alert-secret") || "";
      if (incoming !== ALERT_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const text = await buildDailySummaryV2();
    await sendTelegram(text);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
