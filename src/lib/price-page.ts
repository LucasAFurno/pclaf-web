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

  return {
    before: html.slice(0, starts[0]),
    sections: starts.slice(0, -1).map((start, index) => html.slice(start, starts[index + 1])),
    after: html.slice(starts.at(-1)!)
  };
}
