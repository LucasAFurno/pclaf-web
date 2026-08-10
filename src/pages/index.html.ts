import type { APIRoute } from 'astro';
import { fileResponse } from '../lib/static-site';

export const prerender = true;
export const GET: APIRoute = () => fileResponse('index.html');
