import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import catalog from '../data/demo-catalog.json';
import { demoPage } from './demo-page';

const root = resolve(process.cwd());
const rootFiles = ['CNAME', 'robots.txt', 'sitemap.xml', 'favicon.png', 'apple-touch-icon.png', 'pclafcontrol.html'];
const retiredAssets = new Set(['f1-logo.png', 'f2-logo.png', 'hero-flag-loop-poster.jpg', 'hero-flag-loop-web.mp4']);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.txt', 'text/plain; charset=utf-8'], ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.gif', 'image/gif'], ['.ico', 'image/x-icon'], ['.mp4', 'video/mp4'], ['.woff2', 'font/woff2']
]);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return entry.name === 'dibujis' ? [] : walk(join(directory, entry.name));
    return [join(directory, entry.name)];
  });
}

export function siteFiles(): string[] {
  return [
    ...rootFiles.map(file => join(root, file)).filter(existsSync),
    ...walk(join(root, 'assets')).filter(file => !retiredAssets.has(relative(join(root, 'assets'), file).replaceAll('\\', '/'))),
    ...[...Object.keys(catalog).map(slug => `${slug}.html`), 'demo.html', 'institucional.css']
      .map(file => join(root, 'demos', file)).filter(existsSync),
  ];
}

export function fileResponse(path: string): Response {
  const file = resolve(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return new Response(null, { status: 404 });
  if (path.startsWith('demos/') && extname(file).toLowerCase() === '.html') {
    const html = demoPage(readFileSync(file, 'utf8'), path.slice('demos/'.length, -'.html'.length));
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return new Response(readFileSync(file), { headers: { 'Content-Type': mimeTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream' } });
}
