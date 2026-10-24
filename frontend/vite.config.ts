import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server proxies API routes -> FastAPI so the frontend works
// without CORS headaches when VITE_API_URL is left at its default.
//
// Deep links (e.g. http://localhost:5173/projects) must not be proxied:
// FastAPI has no route for bare page paths and would answer 404/401 JSON
// instead of the SPA shell. `bypass` lets browser document navigations
// (Accept: text/html) fall through to Vite's HTML fallback (index.html),
// while the app's fetch() calls (Accept: */*) keep proxying to the API.
const BACKEND = "http://localhost:8000";

const apiProxy = (path: string): [string, ProxyOptions] => [
  path,
  {
    target: BACKEND,
    changeOrigin: true,
    bypass: (req) =>
      req.headers.accept?.includes("text/html") ? req.url : undefined,
  },
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      [
        "/health",
        "/auth",
        "/profile",
        "/dashboard",
        "/readiness",
        "/careers",
        "/skills",
        "/roadmap",
        "/jobs",
        "/applications",
        "/resumes",
        "/projects",
        "/achievements",
        "/certifications",
        "/interviews",
        "/aptitude",
        "/coding",
        "/ai",
        "/admin",
        // Growth-suite routers (twin / planner / quest). These were added to
        // the backend after the whitelist above; without an entry their
        // requests fall through to the SPA HTML fallback and the client's
        // JSON.parse silently yields null → blank pages. Keep this list in
        // sync with every API path first-segment used in frontend/src.
        "/twin",
        "/planner",
        "/quest",
      ].map(apiProxy),
    ),
  },
});
