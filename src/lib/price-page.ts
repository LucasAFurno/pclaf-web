import { legacyHtml } from './legacy-html';

const sectionMarkers = [
  '<!-- FORMATEO Y SOFTWARE -->',
  '<!-- SERVICE INTERNO -->',
  '<!-- OPTIMIZACIÓN -->',
  '<!-- BACKUP -->',
  '<!-- FAQ PRECIOS -->'
];

export function pricePageParts() {
  const html = legacyHtml('precios.html');
  const starts = sectionMarkers.map(marker => html.indexOf(marker));

  if (starts.some(index => index < 0)) {
    throw new Error('No se pudieron identificar las secciones de precios.');
  }

  const contextStart = html.indexOf('<div class="section price-context">');
  if (contextStart < 0 || contextStart > starts[0]) {
    throw new Error('No se pudo identificar el contexto de precios.');
  }

  return {
    before: html.slice(0, contextStart),
    context: html.slice(contextStart, starts[0]),
    after: html.slice(starts.at(-1)!)
  };
}
