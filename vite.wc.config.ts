import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/web-component.tsx',
      name: 'StepSnapWC',
      fileName: 'stepsnap-viewer-wc',
      formats: ['iife'],
    },
    outDir: 'dist-wc',
    rollupOptions: {
      external: [],
    },
  },
})
