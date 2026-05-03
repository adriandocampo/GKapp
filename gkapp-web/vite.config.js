import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building for GitHub Pages the base must match the repo name.
// For local dev (npm run web:dev) we use '/' so relative paths work.
const base = process.env.GITHUB_PAGES === 'true' ? '/GKapp/' : '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1000,
    outDir: 'dist-web',
  },
  server: {
    port: 5174,
  },
})
