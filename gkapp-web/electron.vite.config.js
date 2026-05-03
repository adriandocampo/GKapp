import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload.js')
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react()],
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html')
        }
      }
    }
  }
})