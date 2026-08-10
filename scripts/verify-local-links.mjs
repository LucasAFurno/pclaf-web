import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function htmlFiles(directory = '.') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', '.astro', 'dist', 'node_modules', 'src', 'supabase', 'tools'].includes(entry.name)) return [];
    const path = `${directory}/${entry.name}`.replace(/^\.\//, '');
    return entry.isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}

const problems = [];
const sources = [...htmlFiles('demos').map(file => ({ file, base: dirname(file) })), ...htmlFiles('src/content/legacy').map(file => ({ file, base: '.' }))];
for (const { file, base } of sources) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)|\$\{|^\//.test(target)) continue;
    const source = resolve(base, target);
    // Las demos apuntan a páginas situadas un nivel arriba. En Astro esas
    // páginas viven como rutas (o como fuente legacy) sin ese prefijo.
    const publicPath = target.replace(/^(?:\.\.\/)+/, '');
    const astroRoute = `src/pages/${publicPath.replace(/\.html$/, '.astro')}`;
    const legacySource = `src/content/legacy/${publicPath}`;
    if (!existsSync(source) && !existsSync(astroRoute) && !existsSync(legacySource)) problems.push(`${file} → ${target}`);
  }
}
if (problems.length) throw new Error(`Rutas locales inexistentes:\n${problems.join('\n')}`);
console.log(`Rutas verificadas: ${sources.length} páginas sin recursos locales faltantes.`);
