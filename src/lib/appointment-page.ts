import { legacyHtml } from './legacy-html';

const stepMarkers = [
  '<!-- STEPS INDICATOR -->',
  '<!-- PASO 1',
  '<!-- PASO 2',
  '<!-- PASO 3',
  '<!-- PASO 4',
  '<!-- CONFIRMADO -->'
];

export function appointmentPageParts() {
  const html = legacyHtml('turnos.html');
  const starts = stepMarkers.map(marker => html.indexOf(marker));

  if (starts.some(index => index < 0)) {
    throw new Error('No se pudieron identificar los pasos del formulario de turnos.');
  }

  const scriptStart = html.indexOf('<script>', starts.at(-1)!);
  if (scriptStart < 0) {
    throw new Error('No se pudo identificar el script del formulario de turnos.');
  }

  return {
    before: html.slice(0, starts[0]),
    steps: starts.map((start, index) => html.slice(start, index === starts.length - 1 ? scriptStart : starts[index + 1])),
    after: html.slice(scriptStart)
  };
}
