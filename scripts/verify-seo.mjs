import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = file => readFileSync(`dist/${file}`, 'utf8');
const catalog = JSON.parse(readFileSync('src/data/demo-catalog.json', 'utf8'));
const sitemap = read('sitemap.xml');
const directory = read('diseno-web.html');
const home = read('index.html');
const titles = new Set();

for (const slug of Object.keys(catalog)) {
  const path = `demos/${slug}.html`;
  const html = read(path);
  const head = html.slice(0, html.indexOf('</head>'));
  const canonical = `https://www.pclaf.com.ar/${path}`;
  const title = head.match(/<title>(.*?)<\/title>/s)?.[1];
  assert(title && !titles.has(title), `Título faltante o duplicado: ${path}`);
  titles.add(title);
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1, path);
  assert(head.includes(`href="${canonical}"`), `Canonical incorrecto: ${path}`);
  assert(head.includes('name="description"'), `Falta descripción: ${path}`);
  assert(head.includes('content="index, follow"'), path);
  assert(html.includes('Sobre este modelo de diseño web'), `Falta contexto visible: ${path}`);
  assert(!html.includes('seo-demo.js'), `SEO depende de JavaScript: ${path}`);
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `Falta en sitemap: ${path}`);
  assert(directory.includes(`href="/${path}"`), `Demo sin enlace desde el catálogo: ${path}`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
}

for (const retired of ['dibujis.html', 'dibujis-admin.html', 'facundo-demo/index.html', 'public/facundo-demo/index.html', 'assets/dibujis/beedrill.jpg', 'assets/f1-logo.png', 'demos/seo-demo.js', 'portfolio-repos/obra-clara/index.html', 'wa_prospectos_floresta.html', 'seviyummy-app/index.html', 'demos/limpieza.html']) {
  assert(!existsSync(`dist/${retired}`), `Se publicó una ruta retirada o local: ${retired}`);
  assert(!sitemap.includes(`/${retired}<`), retired);
}
assert.equal((home.match(/<h1\b/g) || []).length, 1);
assert(!/Colapinto|Varrone|openf1|FAQPage|aggregateRating|body>section:not/.test(home));
assert(!/pclafcontrol\.com\.ar|PCLAFCONTROL/.test(home + read('assets/pclaf-nav.js')));
assert(home.includes('https://operando.app'));
assert(read('pclafcontrol.html').includes('0;url=https://operando.app/'));
assert(read('demos/demo.html').includes('noindex, follow'));
for (const match of home.matchAll(/href="#([^"]+)"/g)) assert(home.includes(`id="${match[1]}"`), `Ancla inexistente: ${match[1]}`);
assert(!/Disallow: \/(?:admin|metricas)\.html/.test(read('robots.txt')), 'El rastreo debe permitir leer el noindex');
console.log(`SEO verificado: ${titles.size} demos indexables, enlaces y sitemap coherentes; rutas retiradas excluidas y home sin contenido obsoleto.`);
