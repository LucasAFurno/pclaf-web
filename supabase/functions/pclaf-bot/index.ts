const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://bcmfzgjpqfjnudhgraan.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    text?: string;
    from?: { first_name?: string };
  };
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
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function countRows(table: string, filter = "") {
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${filter}&limit=1`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  if (!response.ok) throw new Error(await response.text());
  const contentRange = response.headers.get("content-range") || "";
  return Number(contentRange.split("/")[1] || 0);
}

async function sendMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
}

function money(value: unknown) {
  return clean(value, 40) || "sin presupuesto";
}

function labelEstado(estado: string) {
  const labels: Record<string, string> = {
    espera: "en espera",
    proceso: "en reparación",
    listo: "listo",
    entregado: "entregado",
    cancelado: "cancelado",
    pendiente: "pendiente",
    confirmado: "confirmado",
  };
  return labels[estado] || estado;
}

async function resumen() {
  const [total, espera, proceso, listo, entregado, cancelado, turnosPendientes, descuentos] = await Promise.all([
    countRows("reparaciones"),
    countRows("reparaciones", "&estado=eq.espera"),
    countRows("reparaciones", "&estado=eq.proceso"),
    countRows("reparaciones", "&estado=eq.listo"),
    countRows("reparaciones", "&estado=eq.entregado"),
    countRows("reparaciones", "&estado=eq.cancelado"),
    countRows("turnos", "&estado=eq.pendiente"),
    countRows("clientes", "&descuento_resena=eq.true"),
  ]);

  return [
    "Resumen PCLAF",
    "",
    `Reparaciones totales: ${total}`,
    `En espera: ${espera}`,
    `En reparación: ${proceso}`,
    `Listas: ${listo}`,
    `Entregadas: ${entregado}`,
    `Canceladas: ${cancelado}`,
    "",
    `Turnos pendientes: ${turnosPendientes}`,
    `Clientes con descuento activo: ${descuentos}`,
  ].join("\n");
}

async function proximosTurnos(limit = 5) {
  const today = todayBuenosAires();
  const rows = await supa(
    `turnos?select=id,nombre,apellido,telefono,servicio,fecha,hora,estado,urgente&fecha=gte.${today}&estado=neq.cancelado&order=fecha.asc,hora.asc&limit=${limit}`,
  );

  if (!rows?.length) return "No hay próximos turnos cargados.";

  return [
    limit === 1 ? "Próximo turno" : `Próximos ${rows.length} turnos`,
    "",
    ...rows.map((t: Record<string, unknown>, idx: number) => {
      const nombre = [clean(t.nombre, 60), clean(t.apellido, 60)].filter(Boolean).join(" ");
      return [
        `${idx + 1}. ${clean(t.fecha, 20)} ${clean(t.hora, 20)}hs${t.urgente ? " [URGENTE]" : ""}`,
        `${nombre || "Sin nombre"} - ${clean(t.servicio, 100) || "sin servicio"}`,
        `Estado: ${labelEstado(clean(t.estado, 30))}`,
        `${t.telefono ? `Tel: ${clean(t.telefono, 40)}` : ""}`,
      ].filter(Boolean).join("\n");
    }),
  ].join("\n\n");
}

async function reparacionesPorEstado(estado: string, limit = 8) {
  const rows = await supa(
    `reparaciones?select=id,numero,problema,presupuesto,estado,equipos(nombre,modelo,clientes(nombre,apellido,telefono,codigo))&estado=eq.${estado}&order=numero.desc&limit=${limit}`,
  );

  if (!rows?.length) return `No hay reparaciones ${labelEstado(estado)}.`;

  return [
    `Reparaciones ${labelEstado(estado)} (${rows.length})`,
    "",
    ...rows.map((r: Record<string, any>) => {
      const equipo = r.equipos || {};
      const cliente = equipo.clientes || {};
      const nombre = [clean(cliente.nombre, 60), clean(cliente.apellido, 60)].filter(Boolean).join(" ");
      return [
        `#${clean(r.numero, 20)} - ${nombre || "Sin cliente"}`,
        `${clean(equipo.nombre, 80) || "Equipo"}${equipo.modelo ? ` ${clean(equipo.modelo, 80)}` : ""}`,
        `${clean(r.problema, 120) || "Sin problema"}`,
        `Presupuesto: ${money(r.presupuesto)}`,
      ].join("\n");
    }),
  ].join("\n\n");
}

async function descuentos(limit = 15) {
  const rows = await supa(
    `clientes?select=id,codigo,nombre,apellido,telefono&descuento_resena=eq.true&order=nombre.asc&limit=${limit}`,
  );

  if (!rows?.length) return "No hay clientes con descuento activo.";

  return [
    `Clientes con descuento activo (${rows.length})`,
    "",
    ...rows.map((c: Record<string, unknown>, idx: number) => {
      const nombre = [clean(c.nombre, 60), clean(c.apellido, 60)].filter(Boolean).join(" ");
      return `${idx + 1}. ${nombre || "Sin nombre"} - ${clean(c.codigo, 40) || "sin código"}${c.telefono ? ` - ${clean(c.telefono, 40)}` : ""}`;
    }),
  ].join("\n");
}

async function buscarCliente(term: string) {
  const q = encodeURIComponent(`*${term}*`);
  const rows = await supa(
    `clientes?select=id,codigo,nombre,apellido,telefono,descuento_resena&or=(nombre.ilike.${q},apellido.ilike.${q},codigo.ilike.${q},telefono.ilike.${q})&order=nombre.asc&limit=8`,
  );

  if (!rows?.length) return `No encontré clientes para "${term}".`;

  return [
    `Clientes encontrados (${rows.length})`,
    "",
    ...rows.map((c: Record<string, unknown>, idx: number) => {
      const nombre = [clean(c.nombre, 60), clean(c.apellido, 60)].filter(Boolean).join(" ");
      return [
        `${idx + 1}. ${nombre || "Sin nombre"}`,
        `Código: ${clean(c.codigo, 40) || "-"}`,
        `Tel: ${clean(c.telefono, 40) || "-"}`,
        `Descuento: ${c.descuento_resena ? "activo" : "no"}`,
      ].join("\n");
    }),
  ].join("\n\n");
}

function help() {
  return [
    "Bot interno PCLAF",
    "",
    "Comandos:",
    "/resumen - números generales",
    "/espera - reparaciones en espera",
    "/proceso - reparaciones en reparación",
    "/listo - reparaciones listas",
    "/canceladas - reparaciones canceladas",
    "/turno - próximo turno",
    "/turnos - próximos 5 turnos",
    "/descuentos - clientes con descuento",
    "/cliente texto - buscar cliente por nombre, código o teléfono",
    "",
    "Ejemplo:",
    "/cliente tiesto",
  ].join("\n");
}

async function answerCommand(text: string) {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];
  const arg = rest.join(" ").trim();

  if (command === "/start" || command === "/help" || command === "ayuda") return help();
  if (command === "/resumen" || command === "resumen") return await resumen();
  if (command === "/turno" || command === "turno") return await proximosTurnos(1);
  if (command === "/turnos" || command === "turnos") return await proximosTurnos(5);
  if (command === "/espera" || command === "espera") return await reparacionesPorEstado("espera");
  if (command === "/proceso" || command === "proceso") return await reparacionesPorEstado("proceso");
  if (command === "/listo" || command === "/listas" || command === "listo") return await reparacionesPorEstado("listo");
  if (command === "/canceladas" || command === "/cancelado" || command === "canceladas") return await reparacionesPorEstado("cancelado");
  if (command === "/descuentos" || command === "descuentos") return await descuentos();
  if (command === "/cliente" || command === "cliente") {
    if (!arg) return "Usá: /cliente nombre, código o teléfono";
    return await buscarCliente(arg);
  }

  return help();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (TELEGRAM_WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (incomingSecret !== TELEGRAM_WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const update = (await req.json()) as TelegramUpdate;
    const chatId = update.message?.chat?.id;
    const text = clean(update.message?.text, 800);

    if (!chatId || !text) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    if (TELEGRAM_CHAT_ID && String(chatId) !== String(TELEGRAM_CHAT_ID)) {
      await sendMessage(chatId, "Este bot es interno de PCLAF.");
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
    }

    const reply = await answerCommand(text);
    await sendMessage(chatId, reply.slice(0, 3900));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
