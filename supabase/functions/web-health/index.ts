const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ADMIN_EMAIL = 'lucas_yenkoz28@hotmail.com';

function headers(request?: Request) {
  const origin = request?.headers.get('origin') || '';
  const allowed = origin === 'https://www.pclaf.com.ar' || origin === 'https://pclaf.com.ar';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://www.pclaf.com.ar',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(request), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function adminFromRequest(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authorization },
  });
  const user = await response.json().catch(() => null);
  return response.ok && user?.email?.toLowerCase() === ADMIN_EMAIL;
}

async function database(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`Database error ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function host(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname; }
  catch { return ''; }
}

function siteUrl(project: Record<string, unknown>, hostname: string) {
  const configured = String(project.url_publica || '').trim();
  if (configured) return configured.includes('://') ? configured : `https://${configured}`;
  return hostname ? `https://${hostname}` : '';
}

async function checkProject(project: Record<string, unknown>) {
  const hostname = host(project.dominio) || host(project.url_publica);
  const domain: Record<string, string> = hostname
    ? { dominio_estado: 'ok', dominio_detalle: 'DNS operativo' }
    : { dominio_estado: 'pendiente', dominio_detalle: 'Sin dominio o URL configurada' };

  if (hostname) {
    try {
      const records = await Deno.resolveDns(hostname, 'A');
      if (!records.length) throw new Error('Sin registros A');
    } catch (error) {
      domain.dominio_estado = 'error';
      domain.dominio_detalle = `DNS no responde: ${error instanceof Error ? error.message : 'sin registros'}`.slice(0, 240);
    }
  }

  const url = siteUrl(project, hostname);
  const site: Record<string, string> = url
    ? { sitio_estado: 'ok', sitio_detalle: 'Web accesible' }
    : { sitio_estado: 'pendiente', sitio_detalle: 'Sin URL pública configurada' };

  if (url) {
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      site.sitio_detalle = `Web accesible (${response.status})`;
    } catch (error) {
      site.sitio_estado = 'error';
      site.sitio_detalle = `La web no responde: ${error instanceof Error ? error.message : 'error de conexión'}`.slice(0, 240);
    }
  }

  const hosting = domain.dominio_estado === 'pendiente'
    ? { hosting_estado: 'pendiente', hosting_detalle: 'Sin dominio o URL para verificar' }
    : site.sitio_estado === 'ok'
      ? { hosting_estado: 'ok', hosting_detalle: 'Servicio accesible desde Internet' }
      : { hosting_estado: 'error', hosting_detalle: site.sitio_detalle || 'El servicio web no responde' };
  return { ...domain, ...site, ...hosting };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: headers(request) });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, request);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: 'not_configured' }, 503, request);
  if (!(await adminFromRequest(request))) return reply({ error: 'forbidden' }, 403, request);
  try {
    const projects = await database('web_proyectos?select=id,dominio,url_publica');
    const results = await Promise.all((projects || []).map(async (project: Record<string, unknown>) => {
      const health = await checkProject(project);
      await database(`web_proyectos?id=eq.${project.id}`, { method: 'PATCH', body: JSON.stringify(health) });
      return { id: project.id, ...health };
    }));
    return reply({ checked: results.length, projects: results }, 200, request);
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'check_failed' }, 500, request);
  }
});
