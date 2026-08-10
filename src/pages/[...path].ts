import type { APIRoute } from 'astro';
import { relative, resolve } from 'node:path';
import { fileResponse, siteFiles } from '../lib/static-site';

export const prerender = true;

export function getStaticPaths() {
  const root = resolve(process.cwd());
  return siteFiles().filter(file => relative(root, file).replaceAll('\\', '/') !== 'index.html').map(file => ({
    params: { path: relative(root, file).replaceAll('\\', '/') }
  }));
}

export const GET: APIRoute = ({ params }) => fileResponse(params.path ?? '');
