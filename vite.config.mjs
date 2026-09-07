import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/html2pdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/jspdf')) return 'vendor-pdf'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor-react'
        },
      },
    },
  },
})
