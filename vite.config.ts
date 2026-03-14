import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false, // Se 5173 ocupada, usa outra
    open: true, // Abre navegador automaticamente
    host: true, // Permite acesso de outros dispositivos
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('@dnd-kit')) return 'dnd-vendor'
          if (id.includes('@tanstack')) return 'react-query-vendor'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (
            id.includes('@react-pdf') ||
            id.includes('linebreak') ||
            id.includes('hyphen') ||
            id.includes('unicode-properties') ||
            id.includes('unicode-trie') ||
            id.includes('bidi-js') ||
            id.includes('fontkit') ||
            id.includes('restructure') ||
              id.includes('jay-peg')
          ) {
            return 'pdf-vendor'
          }
          if (id.includes('yoga-layout')) {
            return 'pdf-layout-vendor'
          }
          if (
            id.includes('brotli') ||
            id.includes('pako') ||
            id.includes('tiny-inflate') ||
            id.includes('crypto-js')
          ) {
            return 'pdf-utils-vendor'
          }
          return 'vendor'
        },
      },
    },
  },
})
