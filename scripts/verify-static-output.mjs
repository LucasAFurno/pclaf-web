import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const legacyPages = readdirSync('src/content/legacy').filter(file => file.endsWith('.html'));
const files = [...legacyPages, 'assets/pclaf-nav.js', 'assets/hero-flag-loop.mp4'];
const sourceFile = file => existsSync(file) ? file : `src/content/legacy/${file}`;
const hash = file => createHash('sha256').update(readFileSync(sourceFile(file))).digest('hex');
for (const file of files) {
  const built = join('dist', file);
  if (!existsSync(built) || hash(file) !== hash(built)) throw new Error(`El build alteró ${file}`);
}
console.log('Salida verificada: páginas, scripts y recursos clave son idénticos al sitio actual.');
