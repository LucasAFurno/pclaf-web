import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const analyticsTag = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-LJY1CM9SD1"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-LJY1CM9SD1');
</script>`;

export function legacyHtml(filename: string) {
  const html = readFileSync(resolve(process.cwd(), 'src/content/legacy', filename), 'utf8');
  return html.includes('G-LJY1CM9SD1') || !html.includes('</head>')
    ? html
    : html.replace('</head>', `${analyticsTag}\n</head>`);
}
