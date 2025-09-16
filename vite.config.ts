import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use root path on Vercel:
  base: "/", // or simply remove the base line entirely (default is "/")
})
