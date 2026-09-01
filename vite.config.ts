import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // عند النشر على GitHub Pages تحت مسار فرعي، نحتاج لضبط base.
  // محليًا نستخدم '/'، وعلى GitHub Pages نستخدم '/WhatsApp-summary/'.
  base: process.env.GITHUB_ACTIONS ? '/WhatsApp-summary/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'ملخص الواتساب',
        short_name: 'ملخص الواتساب',
        description: 'حلّل محادثات واتساب محليًا داخل جهازك',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        // ملفات مكتبة WebLLM الكبيرة تُحمّل عند الطلب وتُخزّن وقت التشغيل
        globIgnores: ['**/lib-*.js'],
        runtimeCaching: [
          {
            urlPattern: /lib-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webllm-lib-cache',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
})
