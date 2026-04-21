import path from "path"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { exec } from "child_process"
import fs from "fs"

// Local PDF Parser Plugin for Marker
const pdfParserPlugin = () => ({
  name: 'pdf-parser-api',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url === '/api/parse-pdf' && req.method === 'POST') {
        const chunks: any[] = [];
        req.on('data', (chunk: any) => chunks.push(chunk));
        req.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const tempPath = path.resolve(__dirname, 'scripts/temp_process.pdf');
          
          if (!fs.existsSync(path.dirname(tempPath))) {
            fs.mkdirSync(path.dirname(tempPath), { recursive: true });
          }

          fs.writeFileSync(tempPath, buffer);

          // Bilgisayardaki Python ve Marker'ı çalıştır
          exec(`python scripts/parse_regulation.py "${tempPath}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            
            res.setHeader('Content-Type', 'application/json');
            if (error) {
              console.error("Marker Error:", stderr);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Marker ayrıştırma hatası. Lütfen pip install marker-pdf kurulu olduğundan emin olun." }));
              return;
            }

            res.end(stdout);
          });
        });
        return;
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pdfParserPlugin()],
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
