import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server proxies /api -> FastAPI so the frontend works
// without CORS headaches when VITE_API_URL is left at its default.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": { target: "http://localhost:8000", changeOrigin: true },
      "/auth": { target: "http://localhost:8000", changeOrigin: true },
      "/profile": { target: "http://localhost:8000", changeOrigin: true },
      "/dashboard": { target: "http://localhost:8000", changeOrigin: true },
      "/readiness": { target: "http://localhost:8000", changeOrigin: true },
      "/careers": { target: "http://localhost:8000", changeOrigin: true },
      "/skills": { target: "http://localhost:8000", changeOrigin: true },
      "/roadmap": { target: "http://localhost:8000", changeOrigin: true },
      "/jobs": { target: "http://localhost:8000", changeOrigin: true },
      "/applications": { target: "http://localhost:8000", changeOrigin: true },
      "/resumes": { target: "http://localhost:8000", changeOrigin: true },
      "/projects": { target: "http://localhost:8000", changeOrigin: true },
      "/achievements": { target: "http://localhost:8000", changeOrigin: true },
      "/certifications": { target: "http://localhost:8000", changeOrigin: true },
      "/interviews": { target: "http://localhost:8000", changeOrigin: true },
      "/aptitude": { target: "http://localhost:8000", changeOrigin: true },
      "/coding": { target: "http://localhost:8000", changeOrigin: true },
      "/ai": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
