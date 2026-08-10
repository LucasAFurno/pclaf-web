import { existsSync, readFileSync } from 'node:fs';

const sitemap = readFileSync('sitemap.xml', 'utf8');
const expected = [
  '', 'diseno-web.html', 'precios.html', 'turnos.html', 'ubicacion.html',
  'service-tecnico-pc-flores-floresta.html', 'formateo-pc-floresta.html',
  'cambio-pasta-termica-notebook-caba.html', 'limpieza-pc-gamer-floresta.html', 'instalacion-windows-floresta.html'
];
for (const path of expected) {
  const url = `https://www.pclaf.com.ar/${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Falta en sitemap: ${url}`);
  if (path && !existsSync(path)) throw new Error(`Ruta del sitemap inexistente: ${path}`);
}
console.log(`Sitemap verificado: ${expected.length} rutas SEO declaradas.`);
