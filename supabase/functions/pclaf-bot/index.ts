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
  callback_query?: {
    id?: string;
    data?: string;
    message?: {
      chat?: { id?: number | string };
      message_id?: number;
    };
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

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDateAr(value: unknown) {
  const raw = clean(value, 40);
  if (!raw) return "";
  const date = new Date(`${raw}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
  }).format(date);
}

async function supa(path: string) {
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function supaWrite(method: "POST" | "PATCH", path: string, body: Record<string, unknown>) {
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
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

async function telegramApi(method: string, payload: Record<string, unknown>) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

async function sendMessage(chatId: string | number, text: string, replyMarkup?: Record<string, unknown>) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerCallbackQuery(id: string, text = "") {
  await telegramApi("answerCallbackQuery", {
    callback_query_id: id,
    ...(text ? { text } : {}),
  });
}

function money(value: unknown) {
  return clean(value, 40) || "sin presupuesto";
}

function normalizeWhatsappPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.startsWith("15") && digits.length === 10) return `54911${digits.slice(2)}`;
  if (digits.startsWith("11") && digits.length === 10) return `549${digits}`;
  return digits;
}

function whatsappUrl(phone: unknown, message: string) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function repairKeyboard(rep: Record<string, any>) {
  const numero = clean(rep.numero, 20);
  const equipo = rep.equipos || {};
  const cliente = equipo.clientes || {};
  const nombre = clean(cliente.nombre, 60).split(" ")[0] || "";
  const wa = whatsappUrl(
    cliente.telefono,
    `Hola ${nombre}, te escribimos de PCLAF. Tu ${clean(equipo.nombre, 80) || "equipo"} (#${numero}) está ${labelEstado(clean(rep.estado, 30))}.`,
  );

  const rows: Array<Array<Record<string, string>>> = [
    [
      { text: "Ver detalle", callback_data: `rep:${numero}` },
      { text: "Historial", callback_data: `hist:${numero}` },
    ],
    [
      { text: "En reparación", callback_data: `st:proceso:${numero}` },
      { text: "Listo", callback_data: `st:listo:${numero}` },
    ],
    [
      { text: "Entregado", callback_data: `st:entregado:${numero}` },
      { text: "Cancelar", callback_data: `st:cancelado:${numero}` },
    ],
  ];

  if (wa) rows.unshift([{ text: "WhatsApp cliente", url: wa }]);
  return { inline_keyboard: rows };
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

async function turnosPorFecha(label: string, fecha: string) {
  const rows = await supa(
    `turnos?select=id,nombre,apellido,telefono,servicio,fecha,hora,estado,urgente&fecha=eq.${fecha}&estado=neq.cancelado&order=hora.asc`,
  );

  if (!rows?.length) return `No hay turnos para ${label}.`;

  return [
    `Turnos de ${label} (${rows.length})`,
    "",
    ...rows.map((t: Record<string, unknown>, idx: number) => {
      const nombre = [clean(t.nombre, 60), clean(t.apellido, 60)].filter(Boolean).join(" ");
      return [
        `${idx + 1}. ${clean(t.hora, 20)}hs${t.urgente ? " [URGENTE]" : ""}`,
        `${nombre || "Sin nombre"} - ${clean(t.servicio, 100) || "sin servicio"}`,
        `Estado: ${labelEstado(clean(t.estado, 30))}`,
        `${t.telefono ? `Tel: ${clean(t.telefono, 40)}` : ""}`,
      ].filter(Boolean).join("\n");
    }),
  ].join("\n\n");
}

async function urgentes(limit = 10) {
  const [reps, turnos] = await Promise.all([
    supa(
      `reparaciones?select=id,numero,problema,presupuesto,estado,equipos(nombre,modelo,clientes(nombre,apellido,telefono,codigo))&urgente=eq.true&estado=neq.entregado&estado=neq.cancelado&order=numero.desc&limit=${limit}`,
    ),
    supa(
      `turnos?select=id,nombre,apellido,telefono,servicio,fecha,hora,estado,urgente&urgente=eq.true&estado=neq.cancelado&order=fecha.asc,hora.asc&limit=${limit}`,
    ),
  ]);

  const lines = ["Urgentes PCLAF", ""];

  if (reps?.length) {
    lines.push("Reparaciones:");
    reps.forEach((r: Record<string, any>) => {
      const cliente = r.equipos?.clientes || {};
      const nombre = [clean(cliente.nombre, 50), clean(cliente.apellido, 50)].filter(Boolean).join(" ");
      lines.push(`#${clean(r.numero, 20)} - ${nombre || "Sin cliente"} - ${labelEstado(clean(r.estado, 30))}`);
    });
    lines.push("");
  }

  if (turnos?.length) {
    lines.push("Turnos:");
    turnos.forEach((t: Record<string, unknown>) => {
      const nombre = [clean(t.nombre, 50), clean(t.apellido, 50)].filter(Boolean).join(" ");
      lines.push(`${clean(t.fecha, 20)} ${clean(t.hora, 20)}hs - ${nombre || "Sin nombre"} - ${clean(t.servicio, 80)}`);
    });
  }

  if (!reps?.length && !turnos?.length) return "No hay urgentes cargados.";
  return lines.join("\n").trim();
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

async function buscarReparacion(numero: string) {
  const n = clean(numero, 20).replace(/^#/, "");
  if (!n) return null;

  const rows = await supa(
    `reparaciones?select=id,numero,problema,presupuesto,estado,urgente,fecha_entrega,created_at,equipos(nombre,modelo,clientes(nombre,apellido,telefono,codigo,descuento_resena))&numero=eq.${encodeURIComponent(n)}&limit=1`,
  );

  return rows?.[0] || null;
}

async function detalleReparacion(numero: string) {
  const rep = await buscarReparacion(numero);
  if (!rep) return `No encontré la reparación #${clean(numero, 20)}.`;

  const equipo = rep.equipos || {};
  const cliente = equipo.clientes || {};
  const nombre = [clean(cliente.nombre, 60), clean(cliente.apellido, 60)].filter(Boolean).join(" ");
  const pasos = await supa(
    `pasos?select=titulo,estado,nota,fecha,orden&reparacion_id=eq.${rep.id}&order=orden.asc&limit=6`,
  );

  return [
    `Reparación #${clean(rep.numero, 20)}`,
    "",
    `Estado: ${labelEstado(clean(rep.estado, 30))}${rep.urgente ? " [URGENTE]" : ""}`,
    `Cliente: ${nombre || "Sin cliente"}${cliente.codigo ? ` (${clean(cliente.codigo, 40)})` : ""}`,
    `Tel: ${clean(cliente.telefono, 40) || "-"}`,
    `Equipo: ${clean(equipo.nombre, 80) || "Equipo"}${equipo.modelo ? ` ${clean(equipo.modelo, 80)}` : ""}`,
    `Problema: ${clean(rep.problema, 220) || "-"}`,
    `Presupuesto: ${money(rep.presupuesto)}`,
    `Entrega est.: ${clean(rep.fecha_entrega, 80) || "-"}`,
    `Descuento: ${cliente.descuento_resena ? "activo" : "no"}`,
    "",
    pasos?.length
      ? [
        "Últimos pasos:",
        ...pasos.map((p: Record<string, unknown>) =>
          `- ${clean(p.fecha, 40) || ""} ${clean(p.titulo, 100)}${p.nota ? ` - ${clean(p.nota, 120)}` : ""}`.trim()
        ),
      ].join("\n")
      : "Sin pasos cargados.",
  ].join("\n");
}

async function historialReparacion(numero: string, limit = 12) {
  const rep = await buscarReparacion(numero);
  if (!rep) return `No encontré la reparación #${clean(numero, 20)}.`;

  const pasos = await supa(
    `pasos?select=titulo,estado,nota,fecha,orden&reparacion_id=eq.${rep.id}&order=orden.asc&limit=${limit}`,
  );

  if (!pasos?.length) return `La reparación #${clean(rep.numero, 20)} no tiene pasos cargados.`;

  return [
    `Historial #${clean(rep.numero, 20)}`,
    "",
    ...pasos.map((p: Record<string, unknown>) =>
      `- ${clean(p.fecha, 40) || ""} ${clean(p.titulo, 120)}${p.nota ? ` - ${clean(p.nota, 180)}` : ""}`.trim()
    ),
  ].join("\n");
}

async function linkWhatsappReparacion(numero: string) {
  const rep = await buscarReparacion(numero);
  if (!rep) return `No encontré la reparación #${clean(numero, 20)}.`;

  const equipo = rep.equipos || {};
  const cliente = equipo.clientes || {};
  const nombre = clean(cliente.nombre, 60).split(" ")[0] || "";
  const message = `Hola ${nombre}, te escribimos de PCLAF. Tu ${clean(equipo.nombre, 80) || "equipo"} (#${clean(rep.numero, 20)}) está ${labelEstado(clean(rep.estado, 30))}.`;
  const url = whatsappUrl(cliente.telefono, message);
  if (!url) return `La reparación #${clean(rep.numero, 20)} no tiene teléfono cargado.`;
  return [`WhatsApp reparación #${clean(rep.numero, 20)}`, "", url].join("\n");
}

async function cambiarEstadoReparacion(numero: string, estado: string) {
  const rep = await buscarReparacion(numero);
  if (!rep) return `No encontré la reparación #${clean(numero, 20)}.`;

  await supaWrite("PATCH", `reparaciones?id=eq.${rep.id}`, { estado });
  return `Reparación #${clean(rep.numero, 20)} actualizada a ${labelEstado(estado)}.`;
}

async function agregarNota(numero: string, nota: string) {
  const rep = await buscarReparacion(numero);
  if (!rep) return `No encontré la reparación #${clean(numero, 20)}.`;
  const text = clean(nota, 500);
  if (!text) return "Usá: /nota 3288 texto de la nota";

  const rows = await supa(`pasos?select=orden&reparacion_id=eq.${rep.id}&order=orden.desc&limit=1`);
  const orden = rows?.length ? Number(rows[0].orden || 0) + 1 : 1;
  await supaWrite("POST", "pasos", {
    reparacion_id: rep.id,
    orden,
    titulo: "Nota desde Telegram",
    estado: "active",
    nota: text,
    fecha: shortDateAr(todayBuenosAires()),
    icono: "note",
  });

  return `Nota agregada a la reparación #${clean(rep.numero, 20)}.`;
}

async function callbackReply(data: string) {
  const parts = data.split(":");
  const action = parts[0];
  const numero = parts.at(-1) || "";

  if (action === "rep") {
    return {
      text: await detalleReparacion(numero),
      keyboard: repairKeyboard(await buscarReparacion(numero)),
    };
  }

  if (action === "hist") {
    return {
      text: await historialReparacion(numero),
      keyboard: repairKeyboard(await buscarReparacion(numero)),
    };
  }

  if (action === "st") {
    const estado = parts[1] || "";
    const text = await cambiarEstadoReparacion(numero, estado);
    const rep = await buscarReparacion(numero);
    return { text, keyboard: rep ? repairKeyboard(rep) : undefined };
  }

  return { text: helpV2(), keyboard: undefined };
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

function helpV2() {
  return [
    "Bot interno PCLAF",
    "",
    "Comandos:",
    "/resumen - numeros generales",
    "/hoy - turnos de hoy",
    "/manana - turnos de manana",
    "/urgentes - turnos y reparaciones urgentes",
    "/espera - reparaciones en espera",
    "/proceso - reparaciones en reparacion",
    "/listo - reparaciones listas",
    "/canceladas - reparaciones canceladas",
    "/turno - proximo turno",
    "/turnos - proximos 5 turnos",
    "/descuentos - clientes con descuento",
    "/cliente texto - buscar cliente por nombre, codigo o telefono",
    "/reparacion 3288 - detalle de reparacion",
    "/historial 3288 - pasos de la reparacion",
    "/wa 3288 - link de WhatsApp al cliente",
    "/proceso 3288 - pasar a reparacion",
    "/listo 3288 - pasar a listo",
    "/cancelar 3288 - cancelar reparacion",
    "/nota 3288 texto - agregar nota al historial",
    "",
    "Ejemplo:",
    "/reparacion 3288",
  ].join("\n");
}

async function answerCommandV2(text: string) {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];
  const arg = rest.join(" ").trim();

  if (command === "/start" || command === "/help" || command === "ayuda") return helpV2();
  if (command === "/resumen" || command === "resumen") return await resumen();
  if (command === "/hoy" || command === "hoy") return await turnosPorFecha("hoy", todayBuenosAires());
  if (command === "/manana" || command === "/mañana" || command === "manana" || command === "mañana") {
    return await turnosPorFecha("manana", addDays(todayBuenosAires(), 1));
  }
  if (command === "/urgentes" || command === "/urgente" || command === "urgentes") return await urgentes();
  if (command === "/turno" || command === "turno") return await proximosTurnos(1);
  if (command === "/turnos" || command === "turnos") return await proximosTurnos(5);

  if (command === "/espera" || command === "espera") {
    if (arg) return await cambiarEstadoReparacion(arg, "espera");
    return await reparacionesPorEstado("espera");
  }
  if (command === "/proceso" || command === "proceso") {
    if (arg) return await cambiarEstadoReparacion(arg, "proceso");
    return await reparacionesPorEstado("proceso");
  }
  if (command === "/listo" || command === "/listas" || command === "listo") {
    if (arg) return await cambiarEstadoReparacion(arg, "listo");
    return await reparacionesPorEstado("listo");
  }
  if (command === "/entregar" || command === "/entregado" || command === "entregar") {
    if (!arg) return "Usa: /entregar 3288";
    return await cambiarEstadoReparacion(arg, "entregado");
  }
  if (command === "/cancelar" || command === "cancelar") {
    if (!arg) return "Usa: /cancelar 3288";
    return await cambiarEstadoReparacion(arg, "cancelado");
  }
  if (command === "/canceladas" || command === "/cancelado" || command === "canceladas") {
    return await reparacionesPorEstado("cancelado");
  }
  if (command === "/reparacion" || command === "/rep" || command === "reparacion") {
    if (!arg) return "Usa: /reparacion 3288";
    return await detalleReparacion(arg);
  }
  if (command === "/historial" || command === "historial") {
    if (!arg) return "Usa: /historial 3288";
    return await historialReparacion(arg);
  }
  if (command === "/wa" || command === "/whatsapp" || command === "wa") {
    if (!arg) return "Usa: /wa 3288";
    return await linkWhatsappReparacion(arg);
  }
  if (command === "/nota" || command === "nota") {
    const [numero, ...notaParts] = rest;
    if (!numero || !notaParts.length) return "Usa: /nota 3288 texto de la nota";
    return await agregarNota(numero, notaParts.join(" "));
  }
  if (command === "/descuentos" || command === "descuentos") return await descuentos();
  if (command === "/cliente" || command === "cliente") {
    if (!arg) return "Usa: /cliente nombre, codigo o telefono";
    return await buscarCliente(arg);
  }

  return helpV2();
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
    const callback = update.callback_query;
    if (callback?.data && callback.message?.chat?.id) {
      const chatId = callback.message.chat.id;
      if (TELEGRAM_CHAT_ID && String(chatId) !== String(TELEGRAM_CHAT_ID)) {
        if (callback.id) await answerCallbackQuery(callback.id, "Bot interno PCLAF");
        return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
      }

      const result = await callbackReply(clean(callback.data, 120));
      if (callback.id) await answerCallbackQuery(callback.id, "Listo");
      await sendMessage(chatId, result.text.slice(0, 3900), result.keyboard);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = update.message?.chat?.id;
    const text = clean(update.message?.text, 800);

    if (!chatId || !text) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    if (TELEGRAM_CHAT_ID && String(chatId) !== String(TELEGRAM_CHAT_ID)) {
      await sendMessage(chatId, "Este bot es interno de PCLAF.");
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
    }

    const reply = await answerCommandV2(text);
    const [rawCommand, ...parts] = text.trim().split(/\s+/);
    const cmd = rawCommand.toLowerCase().split("@")[0];
    const maybeNumero = parts.join(" ").trim();
    const repForButtons = (cmd === "/reparacion" || cmd === "/rep" || cmd === "reparacion") && maybeNumero
      ? await buscarReparacion(maybeNumero)
      : null;
    await sendMessage(chatId, reply.slice(0, 3900), repForButtons ? repairKeyboard(repForButtons) : undefined);

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
