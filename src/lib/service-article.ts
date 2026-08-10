import { legacyHtml } from './legacy-html';

export function serviceArticleParts(filename: string) {
  const html = legacyHtml(filename);
  const mainStart = html.indexOf('<main>');
  const mainEnd = html.indexOf('</main>', mainStart);

  if (mainStart < 0 || mainEnd < 0) {
    throw new Error(`No se pudo identificar el contenido principal de ${filename}.`);
  }

  const mainClose = mainEnd + '</main>'.length;
  return {
    beforeMain: html.slice(0, mainStart),
    main: html.slice(mainStart, mainClose),
    afterMain: html.slice(mainClose)
  };
}
