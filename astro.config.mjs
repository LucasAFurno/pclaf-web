import { defineConfig } from 'astro/config';

// Preserva las rutas públicas existentes, como /precios.html y /demos/alma.html.
export default defineConfig({
  build: { format: 'file' }
});
