import type { APIRoute } from 'astro';
import services from '../../data/services.json';

export const prerender = true;
export const GET: APIRoute = () => new Response(JSON.stringify(services), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
});
