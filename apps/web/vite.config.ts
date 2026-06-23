import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// Irie Cut ships as a fully client-side SPA — the editor needs no server
// (IndexedDB storage, canvas rendering, in-browser export). This builds to
// static assets in dist/ that deploy anywhere, including Vercel.
export default defineConfig({
  resolve: {
    alias: {
      '#': src,
      '@': src,
    },
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
  ],
})
