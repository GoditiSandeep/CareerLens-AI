# CareerLens AI

**Discover. Prepare. Grow. Get Career-Ready.**

An end-to-end **career-guidance and personal-growth platform** for people across education levels, professions, and career stages: skills tracking, career roadmaps, job/scholarship discovery, an application tracker, resume analysis, interview/aptitude/coding practice, project recommendations, achievements, certifications, and an AI mentor chat — with a FastAPI backend and a React + TypeScript frontend, plus a secure administrator dashboard.

> Works out of the box with **no API keys**: the backend ships with a deterministic mock AI provider. OpenAI- or Gemini-compatible keys can be plugged in via environment variables when you want real model responses.

**Owner:** Godithi Kiran Sri Sai Sandeep · **Contact:** goditisandeep@gmail.com · **Phone:** 8247336510

---

## Tech stack

| Layer     | Stack |
|-----------|-------|
| Backend   | Python, FastAPI, SQLAlchemy 2, Pydantic v2, JWT (PyJWT + bcrypt), SQLite by default (PostgreSQL optional), `pypdf`/`python-docx` resume parsing |
| Frontend  | React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6, Recharts |
| Tooling   | pytest, `tsc --noEmit` type-check, stdlib-only smoke + admin integration tests, Docker / docker-compose |
| Roles     | `student` (default for public sign-up) and `admin` (backend-enforced; never settable via public registration) |

## Repository layout

```
CareerLens-AI/
├── backend/            # FastAPI app (app/api, app/ai, app/models, app/schemas, app/cli, tests)
├── frontend/           # Vite React SPA (src/pages, src/components, src/lib/api.ts)
├── scripts/            # smoke_test.py + admin_integration_test.py
├── docker-compose.yml  # postgres + backend + frontend
├── .env.example        # all supported environment variables (documented)
├── PROGRESS.md         # verified vs. remaining implementation checklist
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

# Optional: SQLite is the default. Copy the example env if you want to change settings.
Copy-Item ..\.env.example .\.env      # backend reads backend\.env (pydantic-settings)

python -m uvicorn app.main:app --reload --port 8000
```

On startup the app creates the database at **`backend\careerlens.db`** (the default `sqlite:///./careerlens.db` is anchored under `backend\` so the server and the helper scripts always open the same file regardless of the working directory). With `SEED_DEMO_DATA=true` (the default) it seeds careers, jobs, skills, aptitude/coding questions, projects and a demo account:

**Demo login:** `demo@careerlens.ai` / `Demo@12345` (public demo data only — never a real credential)

Verify: <http://localhost:8000/health> and interactive docs at <http://localhost:8000/docs>.

### 3. Create the administrator (one time, secure)

Public registration **always** creates student accounts — there is no admin sign-up. Create your administrator with the bundled CLI. It prompts for the password with a **hidden** terminal prompt (it is never echoed, logged, or stored in source/Git — only a bcrypt hash is saved):

```powershell
cd c:\Users\admin\Desktop\CareerLens-AI\backend
python -m app.cli.create_admin
# Admin login email [goditisandeep@gmail.com]:
# Admin full name [Godithi Sandeep]:
# Admin password (hidden): ****
# Confirm password: ****
```

Or pass the email/name as arguments (the password is still prompted securely):

```powershell
python -m app.cli.create_admin --email goditisandeep@gmail.com --name "Godithi Sandeep"
python -m app.cli.create_admin --check          # report admin status without changes
```

Safety behaviour:
- **Never** promotes an existing student account or resets an existing admin password. If the email already exists as a student it stops and prints safe recovery steps.
- The password must be ≥ 8 characters and must not be the email/local-part.
- Re-running is idempotent — an existing admin is left untouched.

Then sign in at <http://localhost:5173/login> and open the admin dashboard at <http://localhost:5173/admin>.

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
# Backend — pytest (31 tests: auth, admin roles/authorization, health, skills, roadmap, jobs, flows)
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

### Admin integration test (stdlib only)

With the backend running and at least one administrator created:

```powershell
cd c:\Users\admin\Desktop\CareerLens-AI
python scripts/admin_integration_test.py
```

It creates a temporary admin, signs in, verifies every `/admin/*` endpoint returns **200** with backend-backed data, then registers a student and confirms the student is **blocked (403)** from every admin API and cannot self-promote — finally cleaning up its test rows. Prints `ALL ADMIN INTEGRATION CHECKS PASSED` on success.

## Docker

```powershell
docker compose up --build
```

- **db** — PostgreSQL 16 with a healthcheck and persistent `pgdata` volume
- **backend** — builds `backend/Dockerfile`, runs uvicorn on <http://localhost:8000>, uses the compose `DATABASE_URL`, seeds demo data, keeps `uploads` in a volume
- **frontend** — multi-stage build `frontend/Dockerfile` (`npm ci && npm run build` → nginx serving `dist/` with SPA fallback on <http://localhost:5173>). `VITE_API_URL` is passed as a **build arg** because Vite inlines `VITE_*` variables at build time.

For Docker, PostgreSQL is the default; local dev keeps the zero-setup SQLite fallback.

## Feature map (Phases A–M)

- **A – Backend:** JWT auth (register/login/me), profile + onboarding, skills + gap analysis, roadmap generation, jobs (search, match %, save, apply), applications Kanban, resume upload/parsing/scoring/job-match, interviews, aptitude tests, coding practice, projects, achievements, certifications, AI chat + history, dashboard/readiness, profile export — all with OpenAPI docs.
- **B – Frontend pages:** Landing, About, Contact, Privacy, Terms, Dashboard, Careers, Skills, Roadmap, Jobs, Applications (drag-style Kanban), Resumes, Practice (interview/aptitude/coding tabs), Projects, Achievements, Chat, Profile, and the admin **Admin dashboard** (`/admin`) — responsive, light/dark themed, typed against `frontend/src/lib/api.ts`.
- **Admin dashboard (`/admin`):** overview analytics, user management (search/filter/paginate, safe role & status changes with self-lockout protection), career & opportunity content CRUD (sample listings clearly labelled), and platform/AI settings that expose provider status without revealing credentials.
- **M – Packaging:** Dockerfiles, docker-compose, `.env.example`, this README, PROGRESS.md, pytest + type-check + smoke + admin-integration tests all green.

### API surface (all under `http://localhost:8000`)

| Area | Representative endpoints |
|------|--------------------------|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Profile | `GET/PUT /profile`, `POST /profile/onboarding`, `GET /profile/export` |
| Dashboard/Readiness | `GET /dashboard`, `GET /readiness` |
| Careers & skills | `GET /careers/recommendations`, `GET /skills/gaps` |
| Roadmap | `GET /roadmap`, `POST /roadmap/generate`, `PATCH /roadmap/items/{id}` |
| Jobs & applications | `GET /jobs`, `GET /applications`, `POST/PATCH/DELETE /applications/{id}` |
| Resume | `POST /resumes/upload`, `POST /resumes/{id}/analyze`, `GET /resumes/{id}/job-match` |
| Practice | `GET /interviews/*`, `GET /aptitude/*`, `GET /coding/*` |
| Projects / growth | `GET /projects/*`, `GET /achievements`, `GET /certifications` |
| AI mentor | `POST /ai/chat`, `GET /ai/chat/history` |
| **Admin** (role required) | `GET /admin/stats`, `GET/PATCH /admin/users`, `GET /admin/settings`, `POST/GET/PATCH/DELETE /admin/careers`, `POST/GET/PATCH/DELETE /admin/jobs` |

The admin endpoints are enforced on the **backend**: a student token receives `403`, and missing/invalid auth receives `401`.

## Troubleshooting

- **Port busy:** stop other uvicorn/Vite instances (`Get-NetTCPConnection -LocalPort 8000`) before restarting.
- **422 on auth:** emails with reserved TLDs (e.g. `.local`) are rejected by validation — use `.com`/`.example.com`.
- **Stale backend after schema changes:** uvicorn without `--reload` needs a restart.
- **Fresh database:** stop the backend and delete `backend/careerlens.db`; it is recreated and re-seeded on next startup.

