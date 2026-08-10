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
for (const file of htmlFiles()) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)|\$\{|^\//.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target))) problems.push(`${file} → ${target}`);
  }
}
if (problems.length) throw new Error(`Rutas locales inexistentes:\n${problems.join('\n')}`);
console.log(`Rutas verificadas: ${htmlFiles().length} páginas sin recursos locales faltantes.`);
