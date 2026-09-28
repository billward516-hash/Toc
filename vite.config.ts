import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths, so the same build works at a domain root or under /Toc/.
  base: './',
  plugins: [react()],
})
