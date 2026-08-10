import { legacyHtml } from './legacy-html';

export function sectionedPageParts(filename: string) {
  const html = legacyHtml(filename);
  const footerStart = html.indexOf('<footer');
  const sectionStarts = [...html.matchAll(/<section\b/g)]
    .map(match => match.index!)
    .filter(index => footerStart < 0 || index < footerStart);

  if (!sectionStarts.length || footerStart < 0) {
    throw new Error(`No se pudieron identificar las secciones de ${filename}.`);
  }

  return {
    beforeSections: html.slice(0, sectionStarts[0]),
    sections: sectionStarts.map((start, index) => html.slice(start, sectionStarts[index + 1] ?? footerStart)),
    afterSections: html.slice(footerStart)
  };
}
