import { existsSync, readFileSync } from 'node:fs';

const sitemap = readFileSync('sitemap.xml', 'utf8');
const expected = [
  '', 'diseno-web.html', 'precios.html', 'consolas.html', 'turnos.html', 'ubicacion.html',
  'service-tecnico-pc-flores-floresta.html', 'formateo-pc-floresta.html',
  'cambio-pasta-termica-notebook-caba.html', 'limpieza-pc-gamer-floresta.html', 'instalacion-windows-floresta.html',
  'diagnostico-pc-notebook-floresta.html', 'optimizacion-pc-lenta-floresta.html',
  'consolas/service-ps3.html', 'consolas/service-ps4-slim.html', 'consolas/service-ps4-pro.html',
  'consolas/service-xbox-one.html', 'consolas/service-xbox-series-s.html', 'consolas/service-xbox-series-x.html', 'consolas/service-ps5.html'
];
for (const path of expected) {
  const url = `https://www.pclaf.com.ar/${path}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) throw new Error(`Falta en sitemap: ${url}`);
  const astroRoute = `src/pages/${path.replace(/\.html$/, '.astro')}`;
  const dynamicConsoleRoute = path.startsWith('consolas/') && existsSync('src/pages/consolas/[slug].astro');
  if (path && !existsSync(path) && !existsSync(astroRoute) && !existsSync(`src/content/legacy/${path}`) && !dynamicConsoleRoute) throw new Error(`Ruta del sitemap inexistente: ${path}`);
}
console.log(`Sitemap verificado: ${expected.length} rutas SEO declaradas.`);
