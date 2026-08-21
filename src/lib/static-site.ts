import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const excluded = new Set(['.git', '.astro', 'dist', 'node_modules', 'src', 'supabase', 'tools']);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.txt', 'text/plain; charset=utf-8'], ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.gif', 'image/gif'], ['.ico', 'image/x-icon'], ['.mp4', 'video/mp4'], ['.woff2', 'font/woff2']
]);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return excluded.has(entry.name) ? [] : walk(join(directory, entry.name));
    return [join(directory, entry.name)];
  });
}

export function siteFiles(): string[] {
  return walk(root).filter(file => {
    const path = relative(root, file).replaceAll('\\', '/');
    return path.startsWith('assets/') || path.startsWith('demos/') || path.endsWith('.html') ||
      ['CNAME', 'robots.txt', 'sitemap.xml', 'favicon.png', 'apple-touch-icon.png'].includes(path);
  });
}

export function fileResponse(path: string): Response {
  const file = resolve(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return new Response(null, { status: 404 });
  if (path.startsWith('demos/') && extname(file).toLowerCase() === '.html') {
    const html = readFileSync(file, 'utf8').replace('</body>', '<script src="/demos/seo-demo.js" defer></script></body>');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(readFileSync(file), { headers: { 'Content-Type': mimeTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream' } });
}
