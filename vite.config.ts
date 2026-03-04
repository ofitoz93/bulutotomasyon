import path from "path"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({ fastRefresh: false })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Sekmeler arası geçişte Vite'ın WebSocket bağlantısının kopması ve
    // sayfanın uyandığında otomatik F5 atmasını engellemeye çalışmak için:
    hmr: {
      overlay: false
    },
    watch: {
      usePolling: true
    }
  }
})
