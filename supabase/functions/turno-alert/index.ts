const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    body: JSON.stringify({
      chat_id: chatId,
      text: buildTelegramMessage(payload),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram send failed: ${text}`);
  }

  return await response.json();
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as TurnoPayload;
    const nombre = clean(payload.nombre, 80);
    const telefono = clean(payload.telefono, 40);
    const servicio = clean(payload.servicio, 140);
    const fecha = clean(payload.fecha, 40);

    if (!nombre || !telefono || !servicio || !fecha) {
      return new Response(JSON.stringify({ error: "Missing required turno fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailMode = (Deno.env.get("TURNO_ALERT_EMAIL_MODE") || "fallback").toLowerCase();

    let telegramOk = false;
    let telegramError = "";
    let emailAttempted = false;
    let emailDelivered = false;
    let emailResult: unknown = null;

    try {
      await sendTelegram(payload);
      telegramOk = true;
    } catch (error) {
      telegramError = error instanceof Error ? error.message : String(error);
    }

    if (emailMode === "always" || !telegramOk) {
      emailAttempted = true;
      emailResult = await sendEmail(payload);
      emailDelivered = !(emailResult && typeof emailResult === "object" && "skipped" in emailResult);
    }

    if (!telegramOk && !emailDelivered) {
      throw new Error(telegramError || "No notification channel could deliver the alert");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        telegram: telegramOk ? "sent" : "failed",
        telegramError: telegramOk ? null : telegramError,
        email: emailAttempted ? emailResult : { skipped: true, reason: "not_needed" },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
