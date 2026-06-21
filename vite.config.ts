import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precache all build assets + fonts
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      manifest: {
        name: 'The Back Room',
        short_name: 'Back Room',
        description: 'Texas Hold\'em poker — a private table for six.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0C0A08',
        theme_color: '#2A1610',
        // Relative paths (no leading slash) so the manifest resolves correctly
        // whether served from the domain root or a GitHub Pages project subpath
        // (e.g. /Texasholdem/). They resolve against the manifest's own URL.
        start_url: '.',
        scope: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
