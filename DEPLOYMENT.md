# HireFlow — Deployment & Operations

Full-stack recruitment platform: React + TypeScript + Vite frontend, FastAPI
backend, PostgreSQL (SQLAlchemy 2 + Alembic).

---

## 1. Architecture in one page

```
Browser (SPA, React 19 + Vite)
  │  fetch(), credentials: 'include'
  │  Authorization: Bearer <access token>      ← in-memory only, 15 min TTL
  ▼
FastAPI (/api/v1)                              ← uvicorn, stateless
  ├─ auth: JWT HS256 + rotating refresh cookie (HttpOnly, SameSite=Lax)
  ├─ RBAC: candidate / recruiter / admin, enforced server-side per request
  ├─ Pydantic v2 validation on every body (extra fields rejected)
  └─ SQLAlchemy 2 sessions (pool_pre_ping, explicit rollback/close)
  ▼
PostgreSQL                                     ← Alembic-managed schema
  ├─ FK constraints with ON DELETE CASCADE
  ├─ CHECK constraints on enums (role, job status, salary range, rating…)
  └─ UNIQUE (candidate_id, job_id) → duplicate applications impossible

Resume files: local volume (RESUME_STORAGE_DIR), opaque names, served only
through an authenticated endpoint. No public/static mount.
```

**Authentication model** — access token in React memory (never
localStorage/sessionStorage), refresh token in an HttpOnly cookie scoped to
`/api/v1/auth`. A 401 triggers one silent refresh-and-replay; refresh tokens
rotate on every use and replay revokes the whole session family.

---

## 2. Prerequisites

| Component | Version | Notes |
|---|---|---|
| Python | 3.11+ | 3.12/3.13 tested |
| Node.js | 20+ | build only |
| PostgreSQL | 14+ | local, Neon, RDS, Cloud SQL… |
| Driver | `psycopg[binary]` v3 | DSN **must** use `postgresql+psycopg://` |

---

## 3. Environment configuration

Copy `.env.example` → `.env` and fill in. Summary of the required values:

```ini
ENVIRONMENT=production                      # development | staging | production
NEON_DSN=postgresql+psycopg://user:pass@host:5432/hireflow?sslmode=require
SECRET_KEY=<64 hex chars>                   # python -c "import secrets; print(secrets.token_hex(32))"
CORS_ORIGINS=https://hireflow.example.com   # exact origins, comma-separated
VITE_API_BASE_URL=https://api.example.com/api/v1
RESUME_STORAGE_DIR=/var/lib/hireflow/resumes
ADMIN_EMAIL=ops@example.com
```

Validation the app performs **before serving traffic** in
`ENVIRONMENT != development`:

* `SECRET_KEY` must exist, be ≥ 32 chars, and not be a known placeholder —
  otherwise startup fails (never silently signs with a default);
* `CORS_ORIGINS=["*"]` is rejected;
* `SameSite=None` requires `REFRESH_COOKIE_SECURE=true`;
* docs/OpenAPI are disabled automatically.

The frontend reads `VITE_API_BASE_URL` at **build time** — set it before
`npm run build`, not in runtime server config.

---

## 4. Backend deploy

```bash
python -m venv .venv
. .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

alembic upgrade head            # creates/updates the schema; safe to re-run

python -m app.cli create-admin  # prompts for a password; admins cannot self-register

uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 \
    --proxy-headers --forwarded-allow-ips "<your-proxy-ip>"
```

Health endpoints for your orchestrator / load balancer:

| Path | Meaning | Use as |
|---|---|---|
| `GET /api/v1/health` | process is up | liveness |
| `GET /api/v1/health/ready` | **+ database reachable** (503 otherwise) | readiness |

Never route traffic on liveness alone — readiness is the one that checks the DB.

Logs are structured single lines with a per-request `request_id` (accepts an
incoming `X-Request-Id`), method, path, status and duration. Request bodies,
query strings and DSNs are never logged.

### Multi-worker note on rate limiting

The auth rate limiter is in-process (`app/security/rate_limit.py`). With
`--workers 2`, each worker keeps its own counters, so the effective limit is
`RATE_LIMIT_AUTH_PER_MIN × workers`. For a hard, exact limit across instances,
replace the `_windows` dict with Redis (`INCR` + `EXPIRE`); the
`FixedWindowLimiter.hit()` interface is one call and is the only place to change.

### Migrations

```bash
alembic upgrade head        # apply
alembic downgrade -1        # roll back one revision
alembic check               # verify models ↔ database are in sync (CI gate)
```

Run migrations **before** starting new API instances (blue-green: migrate first,
then swap). All migrations are additive; none drop data.

---

## 5. Frontend deploy

```bash
npm install
VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build
npm run lint    # tsc --noEmit
```

Deploy the `dist/` directory to any static host/CDN with SPA fallback
(`/index.html` for unknown paths — the app uses `BrowserRouter`).

### Local development

```bash
# terminal 1 — PostgreSQL + API
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
npm run dev                     # http://localhost:3000
```

The dev server proxies `/api/*` → `http://127.0.0.1:8000` (`vite.config.ts`),
which keeps the refresh cookie first-party. Set `API_PROXY_TARGET` to override
the upstream.

---

## 6. Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    client_max_body_size 12m;         # resume uploads (10 MB limit + headroom)

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

TLS is terminated at the proxy; the API enables HSTS automatically when it sees
`https`.

---

## 7. Test suite

```bash
# Requires two throwaway PostgreSQL databases (created if missing):
#   hireflow_dev, hireflow_test
cp .env.example .env      # set TEST_DATABASE_URL + NEON_DSN
pytest                    # 127 tests
```

The suite runs against **real PostgreSQL** (never SQLite) so constraints and
cascades behave as in production. Each test runs inside a transaction that is
rolled back; the schema is rebuilt from Alembic migrations at session start.

The suite refuses to run against any database whose name does not end in
`_test`, so a mistyped DSN cannot wipe a real database.

Coverage by module:

| File | Count | What it proves |
|---|---|---|
| `test_security_isolation.py` | 34 | the 6 mandated cross-tenant cases + IDOR, 404-vs-403 conventions, token forgery, logout/expiry |
| `test_auth.py` | 34 | registration/login, weak-password rejection, no account-existence oracle, refresh rotation & replay detection, logout |
| `test_workflows.py` | 31 | job lifecycle, search/filter/pagination, SQL-injection payloads as literals, resume validation, apply/track, pipeline state machine, admin moderation |
| `test_security_hardening.py` | 22 | config guards (secret/CORS/SameSite), CSRF origin check, security headers, mass-assignment, no static resume mount |
| `test_database.py` | 6 | migration↔model sync, PK/FK/CHECK/CASCADE enforcement at the schema level |

Frontend gates: `npm run lint` (strict TS) and `npm run build`.

---

## 8. Security posture

**Implemented and verified by tests:** bcrypt password hashing (cost 12, 72-byte
cap); HS256 JWTs with `iss`/`exp`/`jti`/`sid` claims, validated on every
request; role resolved from the database per request (a forged `role: admin`
claim gains nothing — tested); rotating refresh tokens with reuse detection;
logout revokes server-side (the access token dies immediately); ownership
checks resolved from the DB membership, never from the request; foreign
resources return 404 (no id enumeration); strict Pydantic schemas
(`extra="forbid"` blocks mass assignment); SQLAlchemy-only data access
(parameterised, injection payloads tested); magic-byte + extension + size
validation on uploads with opaque storage keys (traversal-tested);
per-IP/account rate limiting on credential endpoints; CORS restricted to exact
origins with credentials; `Origin`-checked refresh/logout; CSP,
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`, HSTS on https; secrets refused at boot in production.

**Known residual risks (documented, accepted):**

1. **In-process rate limiter** — per-worker counters, exact only with Redis
   (§4). Fronted by a proxy with `limit_req`, it is adequate for small
   deployments.
2. **JWT revocation is session-family-wide** — logout kills the family; an
   individual stolen *access* token remains valid until expiry (~15 min) if its
   family is otherwise untouched. Refresh tokens themselves are digest-stored.
3. **No email verification / password reset flow yet.** `is_verified` exists but
   no mail is sent; password change requires the current password. Add both
   before operating a public service.
4. **Resume virus scanning is not implemented** — type/size/extension are
   validated, content is served as a forced download with `nosniff`. Add
   ClamAV or an S3 pipeline with scanning before exposing uploads at scale.
5. **Desktop-only operational encryption** — resume files live on a volume;
   restrict host access and encrypt at rest at the infrastructure layer.

---

## 9. Known gaps / not implemented

* Email verification, password-reset-by-email, and invitation flows.
* Job-application attachments beyond the single active resume.
* Real-time notifications (WebSocket) — the `jobs/applicants` tables support a
  feed, but no socket layer exists.
* Admin audit log table is modelled in the architecture doc but not wired.
* i18n — all UI strings are English.

## 10. First-run checklist

```bash
alembic upgrade head
python -m app.cli create-admin          # operator admin account
uvicorn app.main:app --port 8000        # or your process manager
curl -s localhost:8000/api/v1/health/ready   # {"status":"ready","database":"ok"}
```

Then, in the UI: register a recruiter (a company is created automatically) →
post a job → register a candidate → upload a resume → apply → move the stage in
the recruiter pipeline.
