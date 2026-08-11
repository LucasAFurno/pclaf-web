const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGINS = new Set([
  'https://www.pclaf.com.ar',
  'https://pclaf.com.ar',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.pclaf.com.ar',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function code(value: unknown) {
  const result = text(value, 40).toUpperCase();
  return /^[A-Z0-9_-]{3,40}$/.test(result) ? result : '';
}

function date(value: unknown) {
  const result = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : '';
}

function id(value: unknown) {
  const result = text(value, 36);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result) ? result : '';
}

async function api(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Configuración del servidor incompleta');
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`Base de datos: ${res.status}`);
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;
}

async function clientByCode(clientCode: string) {
  const rows = await api(`clientes?codigo=eq.${encodeURIComponent(clientCode)}&select=id,codigo,nombre,apellido,descuento_resena,descuento_origen&limit=1`);
  return rows?.[0] || null;
}

async function history(clientCode: string) {
  const client = await clientByCode(clientCode);
  if (!client) return null;
  const equipos = await api(`equipos?cliente_id=eq.${client.id}&select=id,nombre,modelo,icono&order=created_at.asc`);
  const machines = await Promise.all((equipos || []).map(async (machine: Record<string, string>) => {
    const repairs = await api(`reparaciones?equipo_id=eq.${machine.id}&estado=neq.cancelado&select=id,numero,problema,fecha_entrega,estado,created_at&order=created_at.desc`);
    const safeRepairs = await Promise.all((repairs || []).map(async (repair: Record<string, string>) => {
      const [steps, photos, ratings, reports] = await Promise.all([
        api(`pasos?reparacion_id=eq.${repair.id}&select=id,orden,titulo,nota,estado,fecha,icono&order=orden.asc`),
        api(`fotos?reparacion_id=eq.${repair.id}&select=id,url,tipo,created_at&order=created_at.asc`),
        api(`calificaciones?reparacion_id=eq.${repair.id}&select=id,puntuacion,comentario,created_at&limit=1`),
        api(`reportes?reparacion_id=eq.${repair.id}&select=id,created_at,html_cliente,filename&order=created_at.desc`),
      ]);
      return { ...repair, steps: steps || [], photos: photos || [], ratings: ratings || [], reports: (reports || []).filter((report: Record<string, string>) => !String(report.filename || '').toLowerCase().includes('tecnico')) };
    }));
    return { ...machine, repairs: safeRepairs };
  }));
  return { client, machines: machines.filter((machine: { repairs: unknown[] }) => machine.repairs.length) };
}

async function availability(from: string, to: string) {
  if (!from || !to) throw new Error('Fechas inválidas');
  return await api(`turnos?fecha=gte.${from}&fecha=lte.${to}&estado=neq.cancelado&select=fecha,hora`);
}

async function book(input: Record<string, unknown>) {
  const nombre = text(input.nombre, 60);
  const apellido = text(input.apellido, 60);
  const telefono = text(input.telefono, 24);
  const servicio = text(input.servicio, 120);
  const fecha = date(input.fecha);
  const hora = text(input.hora, 10);
  const nota = text(input.nota, 300);
  const referido = code(input.referido);
  if (!nombre || !telefono || !servicio || !fecha || !/^\d{2}:\d{2}$/.test(hora)) throw new Error('Datos del turno inválidos');
  if (fecha < new Date().toISOString().slice(0, 10)) throw new Error('La fecha debe ser futura');
  const occupied = await api(`turnos?fecha=eq.${fecha}&hora=eq.${encodeURIComponent(hora)}&estado=neq.cancelado&select=id`);
  if ((occupied || []).length >= 2) throw new Error('Ese horario ya no está disponible');
  let referralNote = '';
  if (referido) {
    const client = await clientByCode(referido);
    if (!client) throw new Error('El usuario referido no existe');
    referralNote = `Referido por: ${client.codigo}`;
    await api(`clientes?id=eq.${client.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ descuento_resena: true, descuento_origen: 'referido' }) });
  }
  const fullNote = [referralNote, nota].filter(Boolean).join(' | ');
  const rows = await api('turnos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nombre, apellido: apellido || null, telefono, servicio, fecha, hora, nota: fullNote || null, estado: 'pendiente', urgente: Boolean(input.urgente) }) });
  return { id: rows?.[0]?.id || '' };
}

async function rate(input: Record<string, unknown>) {
  const clientCode = code(input.codigo);
  const repairId = id(input.reparacionId);
  const score = Number(input.puntuacion);
  const comment = text(input.comentario, 800);
  if (!clientCode || !repairId || !Number.isInteger(score) || score < 1 || score > 5) throw new Error('Calificación inválida');
  const client = await clientByCode(clientCode);
  if (!client) throw new Error('Cliente no encontrado');
  const repair = await api(`reparaciones?id=eq.${repairId}&estado=eq.entregado&select=id,equipos!inner(cliente_id)&equipos.cliente_id=eq.${client.id}&limit=1`);
  if (!repair?.[0]) throw new Error('No se puede calificar esta reparación');
  const existing = await api(`calificaciones?reparacion_id=eq.${repairId}&select=id&limit=1`);
  if (existing?.[0]) throw new Error('Esta reparación ya fue calificada');
  await api('calificaciones', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reparacion_id: repairId, puntuacion: score, comentario: comment || null }) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return response(req, { error: 'Método no permitido' }, 405);
  try {
    const input = await req.json();
    switch (input?.action) {
      case 'history': {
        const result = await history(code(input.codigo));
        return response(req, result ? { data: result } : { data: null });
      }
      case 'availability': return response(req, { data: await availability(date(input.desde), date(input.hasta)) });
      case 'referral': {
        const client = await clientByCode(code(input.codigo));
        return response(req, { data: client ? { codigo: client.codigo, nombre: client.nombre, apellido: client.apellido } : null });
      }
      case 'book': return response(req, { data: await book(input) }, 201);
      case 'rate': await rate(input); return response(req, { data: { ok: true } }, 201);
      default: return response(req, { error: 'Acción inválida' }, 400);
    }
  } catch (error) {
    console.error(error);
    return response(req, { error: error instanceof Error ? error.message : 'Error inesperado' }, 400);
  }
});
