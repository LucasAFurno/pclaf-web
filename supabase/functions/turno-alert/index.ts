type TurnoPayload = {
  turnoId?: string;
  shortId?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  servicio?: string;
  urgente?: boolean;
  precio?: string;
  fecha?: string;
  hora?: string;
  equipo?: string;
  nota?: string;
  referidoCodigo?: string;
  referidoNombre?: string;
};

type DatabaseEvent = {
  table?: string;
  type?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

function clean(value: unknown, maxLen = 240) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildTelegramMessage(payload: TurnoPayload) {
  const nombreCompleto = [clean(payload.nombre, 80), clean(payload.apellido, 80)]
    .filter(Boolean)
    .join(" ")
    .trim();
  const refNombre = clean(payload.referidoNombre, 120);
  const refCodigo = clean(payload.referidoCodigo, 60);
  const referido = refCodigo
    ? `${refNombre || refCodigo} (${refCodigo})`
    : "";
  const whatsappUrl = buildWhatsappReplyUrl(payload);

  const lines = [
    "Nuevo turno solicitado",
    "",
    `${payload.shortId ? `Ref: ${clean(payload.shortId, 24)}` : ""}`.trim(),
    `${nombreCompleto ? `Cliente: ${nombreCompleto}` : ""}`.trim(),
    `${payload.telefono ? `Telefono: ${clean(payload.telefono, 40)}` : ""}`.trim(),
    `${payload.servicio ? `Servicio: ${clean(payload.servicio, 140)}` : ""}${
      payload.urgente ? " [URGENTE]" : ""
    }`.trim(),
    `${payload.precio ? `Precio: ${clean(payload.precio, 40)}` : ""}`.trim(),
    `${payload.fecha ? `Fecha: ${clean(payload.fecha, 40)}` : ""}${
      payload.hora ? ` ${clean(payload.hora, 20)}hs` : ""
    }`.trim(),
    `${payload.equipo ? `Equipo: ${clean(payload.equipo, 180)}` : ""}`.trim(),
    `${payload.nota ? `Problema: ${clean(payload.nota, 400)}` : ""}`.trim(),
    `${referido ? `Referido por: ${referido}` : ""}`.trim(),
    `${whatsappUrl ? `Responder por WhatsApp: ${whatsappUrl}` : ""}`.trim(),
    `${payload.turnoId ? `Turno ID: ${clean(payload.turnoId, 80)}` : ""}`.trim(),
  ].filter(Boolean);

  return lines.join("\n");
}

function maskPhone(value: unknown) {
  const phone = clean(value, 40);
  return phone.length > 4 ? `${phone.slice(0, 2)}••••${phone.slice(-2)}` : phone || "-";
}

function estimatedPrice(servicio: unknown, urgente: unknown) {
  const prices: Record<string, [string, string]> = {
    "Limpieza interna PC + pasta térmica": ["$70.000", "$105.000"],
    "Limpieza interna Notebook": ["$90.000", "$135.000"],
    "Formateo Windows 11 + drivers": ["$70.000", "$105.000"],
    "Formateo Windows 11 + drivers + Office + apps": ["$85.000", "$128.000"],
    "Optimización sin formateo": ["$50.000", "$75.000"],
    "Optimización sin formateo GAMER": ["$120.000", "$180.000"],
    "Service GPU / Placa de video": ["$70.000", "$105.000"],
    "Backup de archivos": ["desde $20.000", "desde $30.000"],
    "Atención remota": ["$90.000", "$135.000"],
    "Reparación motherboard": ["desde $95.000", ""],
    "Revisión y diagnóstico": ["Sin cargo", ""],
    "Otro / No sé qué tiene": ["Presupuesto sin cargo", ""],
  };
  const [base, express] = prices[clean(servicio, 140)] || ["", ""];
  return (urgente && express) || base;
}

function parseTurnoRecord(record: Record<string, unknown>): TurnoPayload {
  const note = clean(record.nota, 700);
  const part = (label: string) => clean(note.match(new RegExp(`(?:^|\\|\\s*)${label}:\\s*([^|]+)`, "i"))?.[1] || "", 300);
  const turnoId = clean(record.id, 80);
  return {
    turnoId,
    shortId: turnoId ? `#T${turnoId.slice(0, 6).toUpperCase()}` : "",
    nombre: clean(record.nombre, 80), apellido: clean(record.apellido, 80), telefono: clean(record.telefono, 40),
    servicio: clean(record.servicio, 140), urgente: Boolean(record.urgente), fecha: clean(record.fecha, 40), hora: clean(record.hora, 20),
    precio: estimatedPrice(record.servicio, record.urgente), equipo: part("Equipo"), nota: part("Problema"), referidoCodigo: part("Referido por"),
  };
}

function buildDiscordTurnoMessage(payload: TurnoPayload) {
  const fullName = [clean(payload.nombre, 80), clean(payload.apellido, 80)].filter(Boolean).join(" ");
  const referido = clean(payload.referidoNombre, 120) || clean(payload.referidoCodigo, 60);
  return [
    `Código: ${clean(payload.shortId, 24) || "-"}`,
    `Cliente: ${fullName || "-"}`,
    `Teléfono: ${maskPhone(payload.telefono)}`,
    `Servicio: ${clean(payload.servicio, 140) || "-"}`,
    `Urgencia: ${payload.urgente ? "Sí" : "No"}`,
    `Precio estimado: ${clean(payload.precio, 40) || "-"}`,
    `Fecha y hora: ${clean(payload.fecha, 40)} ${clean(payload.hora, 20)}hs`.trim(),
    `Equipo: ${clean(payload.equipo, 180) || "-"}`,
    `Problema: ${clean(payload.nota, 400) || "-"}`,
    `Referido: ${referido || "-"}`,
    "Estado: pendiente",
    buildWhatsappReplyUrl(payload) ? `WhatsApp: ${buildWhatsappReplyUrl(payload)}` : "",
  ].filter(Boolean).join("\n");
}

function normalizeWhatsappPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54") && digits.length > 10) {
    return digits[2] === "9" ? digits : `549${digits.slice(2)}`;
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("15") && digits.length === 10) return `54911${digits.slice(2)}`;
  if (digits.startsWith("11") && digits.length === 10) return `549${digits}`;
  if (digits.startsWith("9") && digits.length > 10) return `54${digits}`;
  if (digits.length === 10) return `549${digits}`;

  return digits;
}

function buildWhatsappReplyUrl(payload: TurnoPayload) {
  const phone = normalizeWhatsappPhone(payload.telefono);
  if (!phone) return "";

  const nombre = clean(payload.nombre, 80) || "!";
  const fecha = clean(payload.fecha, 40);
  const hora = clean(payload.hora, 20);
  const servicio = clean(payload.servicio, 140);

  const message = [
    `Hola ${nombre}, soy de PCLAF.`,
    `Recibimos tu solicitud de turno${servicio ? ` para ${servicio}` : ""}.`,
    fecha ? `Fecha solicitada: ${fecha}${hora ? ` a las ${hora}hs` : ""}.` : "",
    "Ahora te confirmamos la disponibilidad.",
  ].filter(Boolean).join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildEmailHtml(payload: TurnoPayload) {
  const fullName = [clean(payload.nombre, 80), clean(payload.apellido, 80)]
    .filter(Boolean)
    .join(" ")
    .trim();

  const rows = [
    ["Referencia", clean(payload.shortId, 24)],
    ["Cliente", fullName],
    ["Telefono", clean(payload.telefono, 40)],
    ["Servicio", `${clean(payload.servicio, 140)}${payload.urgente ? " [URGENTE]" : ""}`.trim()],
    ["Precio", clean(payload.precio, 40)],
    [
      "Fecha",
      `${clean(payload.fecha, 40)}${payload.hora ? ` ${clean(payload.hora, 20)}hs` : ""}`.trim(),
    ],
    ["Equipo", clean(payload.equipo, 180)],
    ["Problema", clean(payload.nota, 500)],
    [
      "Referido por",
      clean(payload.referidoCodigo, 60)
        ? `${clean(payload.referidoNombre, 120) || clean(payload.referidoCodigo, 60)} (${clean(payload.referidoCodigo, 60)})`
        : "",
    ],
    ["Turno ID", clean(payload.turnoId, 80)],
  ].filter(([, value]) => value);

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;background:#f7f7f7">${escapeHtml(label)}</td><td style="padding:10px 12px;border:1px solid #ddd">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,sans-serif;color:#111">
    <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:12px;overflow:hidden">
      <div style="padding:20px 24px;background:#111;color:#fff">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#f87171">PCLAF</div>
        <h1 style="margin:8px 0 0;font-size:24px">Nuevo turno solicitado</h1>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse">${tableRows}</table>
      </div>
    </div>
  </body>
</html>`;
}

async function sendTelegram(payload: TurnoPayload) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(payload),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) throw new Error(`Telegram send failed: HTTP ${response.status}`);

  return await response.json();
}

async function sendDiscord(destination: "TURNOS" | "GENERAL" | "DESCUENTOS", title: string, message: string) {
  if (Deno.env.get("PCLAF_WEB_DISCORD_ENABLED") !== "true") return { skipped: true, reason: "disabled" };
  const url = Deno.env.get(`PCLAF_WEB_DISCORD_${destination}_WEBHOOK_URL`);
  if (!url) return { skipped: true, reason: "not_configured" };
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({ embeds: [{ title: `PCLAF Web | ${title}`, description: message.slice(0, 4000), color: 0x2563eb }] }),
  });
  if (!response.ok) throw new Error(`Discord send failed: HTTP ${response.status}`);
  return { sent: true };
}

function databaseDiscordEvent(event: DatabaseEvent) {
  const table = clean(event.table, 40).toLowerCase();
  const type = clean(event.type, 20).toUpperCase();
  const record = event.record || {};
  const old = event.old_record || {};
  if (table === "clientes") {
    if (type === "INSERT") return { destination: "GENERAL" as const, title: "Nuevo cliente", message: `Cliente: ${clean(record.nombre, 80)} ${clean(record.apellido, 80)}\nCódigo: ${clean(record.codigo, 40) || "-"}` };
    if (record.descuento_resena !== old.descuento_resena) return { destination: "DESCUENTOS" as const, title: "Descuento actualizado", message: `Cliente: ${clean(record.nombre, 80)} ${clean(record.apellido, 80)}\nDescuento: 10%\nEstado: ${record.descuento_resena ? "activo" : "inactivo"}\nInicio: no registrado\nVencimiento: no registrado` };
  }
  if (table === "reparaciones") {
    if (type === "INSERT") return { destination: "GENERAL" as const, title: "Nueva reparación registrada", message: `Reparación: #${clean(record.numero, 30) || clean(record.id, 40)}\nEstado: ${clean(record.estado, 40) || "-"}` };
    if (record.estado !== old.estado && clean(record.estado, 40) === "entregado") return { destination: "GENERAL" as const, title: "Reparación entregada", message: `Reparación: #${clean(record.numero, 30) || clean(record.id, 40)}\nEstado: entregado` };
  }
  return null;
}

async function sendEmail(payload: TurnoPayload) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const emailTo = Deno.env.get("TURNO_ALERT_EMAIL_TO");
  const emailFrom = Deno.env.get("TURNO_ALERT_EMAIL_FROM");

  if (!apiKey || !emailTo || !emailFrom) {
    return { skipped: true, reason: "email_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [emailTo],
      subject: `Nuevo turno PCLAF ${clean(payload.shortId, 24) || ""}`.trim(),
      html: buildEmailHtml(payload),
      text: buildTelegramMessage(payload),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email send failed: ${text}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const triggerSecret = Deno.env.get("PCLAF_WEB_TURNO_ALERT_TRIGGER_SECRET") || "";
  if (!triggerSecret || req.headers.get("x-pclaf-turno-alert-secret") !== triggerSecret) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  try {
    const body = (await req.json()) as TurnoPayload | DatabaseEvent;
    if ("table" in body && body.table !== "turnos") {
      const event = databaseDiscordEvent(body);
      if (!event) return Response.json({ ok: true, ignored: true });
      try { await sendDiscord(event.destination, event.title, event.message); return Response.json({ ok: true, discord: "sent" }); }
      catch (error) { console.error("discord_delivery_failed", { message: error instanceof Error ? error.message : "unknown" }); return Response.json({ ok: false }, { status: 502 }); }
    }
    const payload = "record" in body ? parseTurnoRecord(body.record || {}) : body as TurnoPayload;
    const nombre = clean(payload.nombre, 80);
    const telefono = clean(payload.telefono, 40);
    const servicio = clean(payload.servicio, 140);
    const fecha = clean(payload.fecha, 40);

    if (!nombre || !telefono || !servicio || !fecha) {
      return new Response(JSON.stringify({ error: "Missing required turno fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const emailMode = (Deno.env.get("TURNO_ALERT_EMAIL_MODE") || "fallback").toLowerCase();

    let telegramOk = false;
    let telegramError = "";
    let discordOk = false;
    let discordError = "";
    let emailAttempted = false;
    let emailDelivered = false;
    let emailResult: unknown = null;

    const [telegram, discord] = await Promise.allSettled([
      sendTelegram(payload),
      sendDiscord("TURNOS", "Nuevo turno solicitado", buildDiscordTurnoMessage(payload)),
    ]);
    telegramOk = telegram.status === "fulfilled";
    discordOk = discord.status === "fulfilled";
    if (telegram.status === "rejected") telegramError = telegram.reason instanceof Error ? telegram.reason.message : String(telegram.reason);
    if (discord.status === "rejected") discordError = discord.reason instanceof Error ? discord.reason.message : String(discord.reason);

    if (emailMode === "always" || !telegramOk) {
      emailAttempted = true;
      try { emailResult = await sendEmail(payload); emailDelivered = !(emailResult && typeof emailResult === "object" && "skipped" in emailResult); } catch (error) { emailResult = { error: error instanceof Error ? error.message : "email_failed" }; }
    }

    if (!telegramOk && !discordOk && !emailDelivered) {
      throw new Error(telegramError || "No notification channel could deliver the alert");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        telegram: telegramOk ? "sent" : "failed",
        telegramError: telegramOk ? null : "delivery_failed",
        discord: discordOk ? "sent" : "failed",
        discordError: discordOk ? null : "delivery_failed",
        email: emailAttempted ? emailResult : { skipped: true, reason: "not_needed" },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "notification_delivery_failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
