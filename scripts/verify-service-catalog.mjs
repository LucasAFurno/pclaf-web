import { existsSync, readFileSync } from 'node:fs';

const services = JSON.parse(readFileSync('src/data/services.json', 'utf8'));
const source = file => existsSync(file) ? file : `src/content/legacy/${file}`;
const files = {
  'turnos.html': readFileSync(source('turnos.html'), 'utf8'),
  'admin.html': readFileSync(source('admin.html'), 'utf8'),
  'supabase/functions/turno-alert/index.ts': readFileSync('supabase/functions/turno-alert/index.ts', 'utf8')
};
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const service of services) {
  const name = escape(service.name);
  const card = new RegExp(`data-nombre="${name}"[^>]*data-precio="${escape(service.normal)}"[^>]*data-urgencia="${escape(service.urgente)}"`);
  if (!card.test(files['turnos.html'])) throw new Error(`Turnos no coincide con el catálogo: ${service.name}`);

  const admin = new RegExp(`['"]${name}['"]\\s*:\\s*\\{normal:\s*['"]${escape(service.normal)}['"],\\s*urgente:\s*['"]${escape(service.urgente)}['"]\\}`);
  if (admin.test(files['admin.html']) === false && files['admin.html'].includes(service.name)) throw new Error(`Admin no coincide con el catálogo: ${service.name}`);

  const alert = new RegExp(`"${name}"\\s*:\\s*\\["${escape(service.normal)}",\\s*"${escape(service.urgente)}"\\]`);
  if (alert.test(files['supabase/functions/turno-alert/index.ts']) === false && files['supabase/functions/turno-alert/index.ts'].includes(service.name)) throw new Error(`Alertas no coincide con el catálogo: ${service.name}`);
}

console.log(`Catálogo verificado: ${services.length} servicios consistentes con los puntos que los consumen.`);
