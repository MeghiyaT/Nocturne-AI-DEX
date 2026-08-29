import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Midnight SDK packages reference process.env in some modules
    'process.env': {},
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      // Node.js built-in polyfills for Midnight SDK browser compatibility
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    // Pre-bundle Midnight SDK packages for faster dev starts
    include: ['buffer'],
    esbuildOptions: {
      // Inject Buffer global for packages that reference it
      define: {
        global: 'globalThis',
      },
    },
  },
})
