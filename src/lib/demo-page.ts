import catalog from '../data/demo-catalog.json';

const origin = 'https://www.pclaf.com.ar';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function demoPage(html: string, slug: string) {
  const demo = catalog[slug as keyof typeof catalog];
  if (!demo) {
    // El visor genérico depende de parámetros: las muestras completas tienen sus propias URLs.
    return html.replace('</head>', '<meta name="robots" content="noindex, follow"><link rel="canonical" href="https://www.pclaf.com.ar/diseno-web.html"></head>');
  }
  const url = `${origin}/demos/${slug}.html`;
  const title = `${demo.title} | Modelo ${slug.replaceAll('-', ' ')} | PCLAF`;
  const metadata = `<title>${escape(title)}</title>
<meta name="description" content="${escape(demo.description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(demo.description)}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CreativeWork', name: demo.title,
    description: demo.description, url, inLanguage: 'es-AR',
    creator: { '@type': 'Organization', name: 'PCLAF', url: origin },
  }).replaceAll('<', '\\u003c')}</script>
<style>
.pclaf-demo-context{box-sizing:border-box;position:relative;z-index:1;background:#101010;color:#f5f5f5;padding:36px 24px;font:16px/1.65 Arial,sans-serif;text-align:left;letter-spacing:normal}
.pclaf-demo-context>div{max-width:960px;margin:auto}.pclaf-demo-context h2{font:700 clamp(24px,4vw,36px)/1.2 Arial,sans-serif;color:#fff;margin:12px 0;text-transform:none;letter-spacing:normal}
.pclaf-demo-context p{max-width:780px;color:#ddd;margin:12px 0;font:16px/1.65 Arial,sans-serif}.pclaf-demo-context a{display:inline-block;color:#fff;text-decoration:underline;margin:8px 24px 0 0}.pclaf-demo-context small{color:#ff8b78;font:700 12px/1.5 Arial,sans-serif}
.pclaf-demo-label{position:relative;z-index:1;margin:0;background:#101010;color:#eee;padding:10px 20px;text-align:center;font:13px/1.5 Arial,sans-serif}.pclaf-demo-label a{color:#fff;text-decoration:underline}
</style>`;
  const caseStudy = `<section class="pclaf-demo-context" aria-label="Sobre este modelo de diseño web"><div>
<small>PORTFOLIO DE PCLAF · ${escape(demo.plan)}</small>
<h2>${escape(demo.title)}</h2><p>${escape(demo.description)}</p>
<p>Esta es una demostración de diseño de PCLAF. La marca y los datos del negocio son ilustrativos; no se ofrecen los servicios del negocio de ejemplo desde esta página. Adaptamos el contenido, la identidad y las funciones al proyecto de cada cliente.</p>
<a href="/diseno-web.html#modelos-web">Ver todos los modelos de PCLAF</a>
<a href="https://wa.me/5491135708345?text=${encodeURIComponent(`Hola, quiero consultar por el modelo ${slug} de PCLAF.`)}" target="_blank" rel="noopener noreferrer">Consultar por este modelo</a>
</div></section>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace('</head>', `${metadata}</head>`)
    .replace(/<body([^>]*)>/i, '<body$1><aside class="pclaf-demo-label">Modelo de diseño web de <a href="/diseno-web.html">PCLAF</a> · Negocio de ejemplo</aside>')
    .replace('</body>', `${caseStudy}</body>`);
}

export function demoDirectory() {
  return `<section id="modelos-web" style="max-width:1100px;margin:0 auto;padding:40px 24px"><h2>Explorá los modelos de diseño web</h2><p>Ejemplos de PCLAF para distintos rubros. Cada modelo explica su propuesta y se puede adaptar a tu negocio.</p><ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:20px">${Object.entries(catalog).map(([slug, demo]) => `<li><a style="color:inherit;text-decoration:underline" href="/demos/${slug}.html">${escape(demo.title)}</a></li>`).join('')}</ul></section>`;
}
