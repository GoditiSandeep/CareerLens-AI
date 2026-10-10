# CareerLens AI

An end-to-end **student career-guidance platform**: skills tracking, career roadmaps, job discovery, an application tracker, resume analysis, interview/aptitude/coding practice, project recommendations, achievements, and an AI mentor chat — with a FastAPI backend and a React + TypeScript frontend.

> Works out of the box with **no API keys**: the backend ships with a deterministic mock AI provider. OpenAI- or Gemini-compatible keys can be plugged in via environment variables when you want real model responses.

---

## Tech stack

| Layer     | Stack |
|-----------|-------|
| Backend   | Python, FastAPI, SQLAlchemy 2, Pydantic v2, JWT (PyJWT + bcrypt), SQLite by default (PostgreSQL optional), `pypdf`/`python-docx` resume parsing |
| Frontend  | React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6, Recharts |
| Tooling   | pytest, `tsc --noEmit` type-check, stdlib-only smoke test, Docker / docker-compose |

## Repository layout

```
CareerLens-AI/
├── backend/            # FastAPI app (app/api, app/ai, app/models, app/schemas, app/seed, tests)
├── frontend/           # Vite React SPA (src/pages, src/components, src/lib/api.ts)
├── scripts/            # smoke_test.py — end-to-end HTTP journey check
├── docker-compose.yml  # postgres + backend + frontend
├── .env.example        # all supported environment variables (documented)
└── README.md
```

---

## Quick start (PowerShell, local dev)

### 1. Backend (port 8000)

```powershell
cd c:\Users\admin\Desktop\CareerLens-AI\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if you use a venv
pip install -r requirements.txt

# Optional: SQLite is the default, but you can customize:
Copy-Item ..\.env.example .\.env      # backend reads backend\.env (pydantic-settings)

python -m uvicorn app.main:app --reload --port 8000
```

On startup the app creates `careerlens.db`, and (with `SEED_DEMO_DATA=true`, the default) seeds careers, jobs, skills, aptitude/coding questions, projects and a demo account:

**Demo login:** `demo@careerlens.ai` / `Demo@12345`

Verify: <http://localhost:8000/health> and interactive docs at <http://localhost:8000/docs>.

### 2. Frontend (port 5173)

```powershell
cd c:\Users\admin\Desktop\CareerLens-AI\frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies API routes (`/auth`, `/skills`, `/jobs`, `/ai`, …) to `http://localhost:8000`, so no extra configuration is needed. Setting `VITE_API_URL` (e.g. in `frontend\.env`) overrides the base URL for non-proxy setups.

---

## Environment variables

Copy `.env.example` to `backend/.env` and edit as needed. Highlights:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | dev value | JWT signing key — **change in production** |
| `DATABASE_URL` | `sqlite:///./careerlens.db` | SQLite fallback; swap for `postgresql+psycopg://…` (see `.env.example`) |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Comma-separated allowed origins |
| `SEED_DEMO_DATA` | `true` | Seed reference data + demo account on startup |
| `AI_PROVIDER` | `mock` | `mock` \| `openai` \| `gemini` |
| `MOCK_AI_MODE` | `true` | Deterministic offline AI responses |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | – | Any OpenAI-compatible endpoint (OpenAI, Groq, Together, OpenRouter…) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | – | Google Gemini |

### AI credentials

- **No key needed.** With `AI_PROVIDER=mock` (or an empty key) every AI feature — chat mentor, skill-gap analysis, roadmap generation, resume review, interview questions, project ideas — uses a built-in deterministic generator, so the product is fully demoable offline.
- **Real provider:** set `AI_PROVIDER=openai` + `OPENAI_API_KEY` (optionally `OPENAI_BASE_URL`/`OPENAI_MODEL`), or `AI_PROVIDER=gemini` + `GEMINI_API_KEY`. The backend falls back to mock automatically if a key is missing, so you can't break the app by misconfiguring.

## Tests, type-check and smoke test

```powershell
# Backend — pytest (15 tests: auth, health, skills, roadmap, jobs, flows)
cd c:\Users\admin\Desktop\CareerLens-AI\backend
python -m pytest tests/ -q

# Frontend — TypeScript check + production build (outputs frontend/dist)
cd c:\Users\admin\Desktop\CareerLens-AI\frontend
npm run typecheck
npm run build
```

### End-to-end smoke test (stdlib only, no extra deps)

With the backend on `:8000` and/or the frontend dev server on `:5173`:

```powershell
cd c:\Users\admin\Desktop\CareerLens-AI
python scripts/smoke_test.py http://localhost:8000    # direct against FastAPI
python scripts/smoke_test.py http://localhost:5173    # through the Vite dev proxy
```

It registers a fresh user and walks the full journey — login, dashboard, profile/onboarding, skills + gaps, roadmap, jobs (search/save/apply), applications (create → move), resume upload → analyze → job-match, interview/aptitude/coding practice, projects, AI chat, achievements, certifications, readiness and profile export — printing `ALL SMOKE CHECKS PASSED` on success (exit code 0).

> Note: emails must use a non-reserved TLD (the script uses `@example.com`), and query-string spaces are percent-encoded.

## Docker

```powershell
docker compose up --build
```

- **db** — PostgreSQL 16 with a healthcheck and persistent `pgdata` volume
- **backend** — builds `backend/Dockerfile`, runs uvicorn on <http://localhost:8000>, uses the compose `DATABASE_URL`, seeds demo data, keeps `uploads` in a volume
- **frontend** — multi-stage build `frontend/Dockerfile` (`npm ci && npm run build` → nginx serving `dist/` with SPA fallback on <http://localhost:5173>). `VITE_API_URL` is passed as a **build arg** because Vite inlines `VITE_*` variables at build time.

For Docker, PostgreSQL is the default; local dev keeps the zero-setup SQLite fallback.

## Feature map (Phases A–F)

- **A – Backend:** JWT auth (register/login/me), profile + onboarding, skills + gap analysis, roadmap generation, jobs (search, match %, save, apply), applications Kanban, resume upload/parsing/scoring/job-match, interviews, aptitude tests, coding practice, projects, achievements, certifications, AI chat + history, dashboard/readiness, profile export — all with OpenAPI docs.
- **B – Frontend pages:** Dashboard, Careers, Skills, Roadmap, Jobs, Applications (drag-style Kanban), Resumes, Practice (interview/aptitude/coding tabs), Projects, Achievements, Chat, Profile/Landing/Login — dark-themed, responsive, typed against `frontend/src/lib/api.ts`.
- **F – Packaging:** Dockerfiles, docker-compose, `.env.example`, this README, pytest + type-check + smoke test all green.

## Troubleshooting

- **Port busy:** stop other uvicorn/Vite instances (`Get-NetTCPConnection -LocalPort 8000`) before restarting.
- **422 on auth:** emails with reserved TLDs (e.g. `.local`) are rejected by validation — use `.com`/`.example.com`.
- **Stale backend after schema changes:** uvicorn without `--reload` needs a restart.
- **Fresh database:** stop the backend and delete `backend/careerlens.db`; it is recreated and re-seeded on next startup.

