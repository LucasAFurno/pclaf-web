import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = ['index.html', 'precios.html', 'turnos.html', 'historial.html', 'assets/pclaf-nav.js', 'assets/hero-flag-loop.mp4'];
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
for (const file of files) {
  const built = join('dist', file);
  if (!existsSync(built) || hash(file) !== hash(built)) throw new Error(`El build alteró ${file}`);
}
console.log('Salida verificada: páginas, scripts y recursos clave son idénticos al sitio actual.');
