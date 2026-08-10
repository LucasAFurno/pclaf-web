import { defineCollection } from 'astro:content';

// La carpeta contiene HTML de transición publicado por rutas Astro.
export const collections = { legacy: defineCollection({ loader: () => [] }) };
