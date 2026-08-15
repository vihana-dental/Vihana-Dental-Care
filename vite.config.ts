import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    build: {
      rollupOptions: {
        output: {
          // Split the stable third-party code away from application code so a
          // content change (a new service, an edited FAQ) doesn't invalidate
          // the whole ~180KB download for returning visitors — React and the
          // animation/icon libraries keep their long-lived cache entries.
          // Matched against resolved module paths rather than a bare-specifier
          // map: the app imports `react-dom/client`, which a `['react-dom']`
          // entry does not match, so react-dom silently stayed in the main
          // chunk and vendor-react came out at a suspicious 4KB.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          },
        },
      },
      // Google Maps and the admin console are now separate chunks; anything
      // still crossing this line is worth a second look rather than silence.
      chunkSizeWarningLimit: 300,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
