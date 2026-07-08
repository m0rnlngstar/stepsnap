import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Build mode: 'lib' (npm package) or 'embed' (standalone script tag)
const mode = process.env.BUILD_MODE ?? 'lib'

export default defineConfig(({ command }) => ({
  // keep demo assets (favicon…) out of library/embed builds, but serve them in dev
  publicDir: command === 'build' ? false : 'public',
  plugins: [react()],
  build:
    mode === 'embed'
      ? {
          outDir: 'dist-embed',
          lib: {
            entry: resolve(__dirname, 'src/embed.tsx'),
            name: 'StepSnap',
            fileName: () => 'stepsnap-embed.js',
            formats: ['iife'],
          },
          rollupOptions: {
            // React is bundled IN — no external deps
            output: { inlineDynamicImports: true },
          },
        }
      : {
          lib: {
            entry: resolve(__dirname, 'src/lib/index.ts'),
            name: 'StepSnap',
            fileName: 'stepsnap',
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'react/jsx-runtime': 'jsxRuntime',
              },
            },
          },
        },
}))
