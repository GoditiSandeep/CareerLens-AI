# Deploying CareerLens AI

Production deployment on a Linux VPS with Docker Compose, using the template
`docker-compose.prod.example.yml`. All values come from a local `.env` file —
**no secrets live in Git, in this document, or in Docker images**.

> The development stack (`docker-compose.yml`) binds localhost ports and uses
> dev placeholder credentials. Never run it on a public host.

## What the production template guarantees

| Concern | How it is handled |
| --- | --- |
| Secret key / JWTs | Backend refuses to boot (`ENVIRONMENT=production`) if `SECRET_KEY` is a default/placeholder or shorter than 32 chars — JWT forgery with a known key is impossible |
| API docs | `DEBUG=false` removes `/docs`, `/redoc`, `/openapi.json` from the public surface |
| CORS | Backend refuses to boot if `CORS_ORIGINS` still contains `localhost` |
| Database exposure | PostgreSQL has **no host port mapping** — reachable only by the backend container on the internal network |
| DB persistence | Named volume `pgdata` survives redeploys and container removal |
| Upload persistence | Named volume `uploads` survives redeploys |
| Frontend API URL | `VITE_API_URL` is a **required** build arg — no localhost can be baked into the bundle |
| Secrets in images | `backend/.dockerignore` + `frontend/.dockerignore` exclude `.env*`, `*.db*`, `uploads/`, `node_modules` from build contexts |
| Secrets in Git | `.gitignore` excludes `.env`, `*.env`, `docker-compose.prod.yml`, databases and private uploads |
| Upload filenames | Stored names are sanitised to `user{id}_{uuid}_{safe}`; traversal attempts can never escape `uploads/` |
| Host ports | API on `127.0.0.1:8000`, site on `127.0.0.1:8080` — public traffic only via your TLS reverse proxy |

## 1. Prerequisites

- Linux VPS with Docker Engine + Compose v2
- DNS records pointing at the VPS, e.g. `app.example.com` (frontend) and
  `api.example.com` (backend)
- A TLS reverse proxy on the host (recommended: Caddy — automatic HTTPS):

```caddy
app.example.com {
    reverse_proxy 127.0.0.1:8080
}
api.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

## 2. Configure

```bash
cp docker-compose.prod.example.yml docker-compose.prod.yml   # git-ignored
cp .env.example .env                                         # git-ignored
```

Generate strong secrets — the placeholders below must never be reused:

```bash
python -c "import secrets; print(secrets.token_hex(32))"   # -> SECRET_KEY
python -c "import secrets; print(secrets.token_hex(24))"   # -> POSTGRES_PASSWORD (URL-safe hex)
```

`.env` (production):

```bash
ENVIRONMENT=production
DEBUG=false
SECRET_KEY=<64-hex-chars>
POSTGRES_PASSWORD=<48-hex-chars>
CORS_ORIGINS=https://app.example.com
VITE_API_URL=https://api.example.com
# optional overrides
ACCESS_TOKEN_EXPIRE_MINUTES=10080
AI_PROVIDER=mock
MOCK_AI_MODE=true
SEED_DEMO_DATA=true
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | yes | Signs JWTs; ≥ 32 chars, unique per environment |
| `POSTGRES_PASSWORD` | yes | Database password (use hex — it is URL-safe) |
| `CORS_ORIGINS` | yes | Comma-separated public frontend origin(s) |
| `VITE_API_URL` | yes | Public backend origin baked into the frontend bundle at build time |
| `POSTGRES_USER` / `POSTGRES_DB` | no | Defaults to `careerlens` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | JWT lifetime (default 7 days) |
| `AI_PROVIDER` / `MOCK_AI_MODE` | no | `mock` = fully offline mock AI (default) |
| `SEED_DEMO_DATA` | no | Seeds demo data + demo account (default `true`) |

### Live AI (optional)

To use a real provider, extend the compose template's backend `environment`
(e.g. `AI_PROVIDER=openai`, `OPENAI_API_KEY=...`). Put the key **only** in the
local `.env`, never in a committed file. `GET /admin/ai/status` (admin JWT)
shows the active mode.

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

The backend validates its configuration at boot and **fails fast with an
explanatory error** if anything is unsafe — fix `.env` and restart.

## 4. Post-deploy

1. Create the admin (password is prompted, never committed):
   ```bash
   docker compose -f docker-compose.prod.yml exec backend python -m app.cli.create_admin
   ```
2. Health check: `curl https://api.example.com/health` → `{"status": ...}`
3. Confirm docs are hidden: `curl -i https://api.example.com/docs` → `404`
4. Log in at `https://app.example.com` and upload a resume end-to-end.
5. While `SEED_DEMO_DATA=true` the seeded demo account works out of the box —
   see “Decisions for the owner” below.

## Persistence, backups, restore

All state lives in two named Docker volumes:

| Volume | Contains |
| --- | --- |
| `pgdata` | PostgreSQL data (users, resumes, matches) |
| `uploads` | Private uploaded resume files (`/app/uploads`) |

Backup (run on a schedule; store off-server):

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U careerlens careerlens > backup-$(date +%F).sql
docker run --rm -v careerlens-ai_uploads:/data -v "$PWD":/backup alpine \
    tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Restore sketch: load the SQL dump into a fresh database and untar the uploads
archive into the uploads volume. **Never use `docker compose down -v`** — the
`-v` flag deletes volumes (your data). Plain `down` keeps them.

## Redeploying

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Volumes and data are untouched by redeploys.

## Verification (also automated as tests)

```bash
cd backend && python -m pytest
cd frontend && npx tsc -b && npm run build
```

Security regression tests: `backend/tests/test_deployment_security.py`
(production fail-fast configuration, docs gating, upload path-traversal
protection).

## Decisions for the owner

- **Demo account** — seeded (`demo@careerlens.ai`) while `SEED_DEMO_DATA=true`;
  disable seeding or remove demo credentials before real users sign up.
- **JWT lifetime** — production template defaults to 7 days; shorten
  (`ACCESS_TOKEN_EXPIRE_MINUTES=1440`) for daily re-auth.
- **Token storage** — the SPA keeps JWTs in `localStorage` (current design);
  moving to httpOnly cookies would be an application change.
- **Live AI keys** — optional; mock mode is fully functional offline.
- **Public API docs** — off in production by design (docs follow `DEBUG`);
  ask for an explicit `ENABLE_DOCS` flag if you want them with `DEBUG=false`.