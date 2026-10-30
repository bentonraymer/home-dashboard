import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';

const backend = `http://127.0.0.1:${process.env.PORT ?? 8080}`;

// In dev, serve settings.html at /settings like the production server does.
const settingsRoute: Plugin = {
  name: 'settings-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/settings' || req.url?.startsWith('/settings?')) req.url = req.url.replace('/settings', '/settings.html');
      next();
    });
  },
};

export default defineConfig({
  root: 'web',
  plugins: [svelte({ configFile: false }), settingsRoute],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    // Smart-TV browsers lag behind desktop Chrome; keep the output conservative.
    target: 'es2020',
    rollupOptions: {
      input: {
        index: path.resolve('web/index.html'),
        settings: path.resolve('web/settings.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/auth': backend,
      '/wallpapers': backend,
    },
  },
});
