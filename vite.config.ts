import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/ML-Algorithms-Games/", // <<— repo name (case-sensitive)
})
