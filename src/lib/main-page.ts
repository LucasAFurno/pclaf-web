import { legacyHtml } from './legacy-html';

export function mainPageParts(filename: string) {
  const html = legacyHtml(filename);
  const mainStart = html.indexOf('<main');
  const bodyStart = html.indexOf('<body');
  const contentStart = mainStart >= 0 ? mainStart : bodyStart;
  const openTagEnd = html.indexOf('>', contentStart);
  const contentEnd = mainStart >= 0 ? html.indexOf('</main>', openTagEnd) : html.indexOf('</body>', openTagEnd);

  if (contentStart < 0 || openTagEnd < 0 || contentEnd < 0) {
    throw new Error(`No se pudo identificar el contenido principal de ${filename}.`);
  }

  const closeTag = mainStart >= 0 ? '</main>' : '</body>';
  const contentClose = contentEnd + closeTag.length;
  return {
    beforeMain: html.slice(0, contentStart),
    main: html.slice(contentStart, contentClose),
    afterMain: html.slice(contentClose)
  };
}
