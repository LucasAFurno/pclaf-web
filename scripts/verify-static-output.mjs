import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// El index y Diagnóstico viven en Astro; el resto de las páginas legacy
// debe permanecer byte a byte estable hasta su migración individual.
const migratedPages = new Set(['index.html', 'diagnostico-pc-notebook-floresta.html', 'service-tecnico-pc-flores-floresta.html', 'diseno-web.html', 'turnos.html', 'historial.html', 'cambio-pasta-termica-notebook-caba.html', 'formateo-pc-floresta.html', 'instalacion-windows-floresta.html', 'limpieza-pc-gamer-floresta.html', 'optimizacion-pc-lenta-floresta.html', 'ubicacion.html', 'metricas.html', 'pclaf-index.html', 'precios.html', 'admin.html', '404.html']);
const legacyPages = readdirSync('src/content/legacy').filter(file => file.endsWith('.html') && !migratedPages.has(file));
const files = [...legacyPages, 'assets/pclaf-nav.js', 'assets/hero-flag-loop.mp4'];
const sourceFile = file => existsSync(file) ? file : `src/content/legacy/${file}`;
const hash = file => createHash('sha256').update(readFileSync(sourceFile(file))).digest('hex');
for (const file of files) {
  const built = join('dist', file);
  if (!existsSync(built) || hash(file) !== hash(built)) throw new Error(`El build alteró ${file}`);
}
console.log('Salida verificada: páginas, scripts y recursos clave son idénticos al sitio actual.');
