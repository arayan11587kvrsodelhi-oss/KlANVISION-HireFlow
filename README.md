# HireFlow

Full-stack recruitment platform: **React + TypeScript + Vite** frontend, **FastAPI +
SQLAlchemy 2 + PostgreSQL** backend, **Alembic** migrations.

Candidates register, build a profile, upload a resume, browse/search jobs, apply,
and track their pipeline. Recruiters get a company (created automatically at
registration), post and manage jobs, and review applicants. Admins govern
accounts, verify companies and moderate listings.

## Quick start

```bash
# 1. Configure
cp .env.example .env      # then set NEON_DSN, SECRET_KEY, CORS_ORIGINS, VITE_API_BASE_URL

# 2. Backend
python -m venv .venv && .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. First administrator (there is no public admin registration)
python -m app.cli create-admin

# 4. Frontend (separate terminal)
npm install
npm run dev             # http://localhost:3000, proxies /api -> :8000
```

Detailed deployment, reverse-proxy and operations guidance: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Tests

```bash
pytest                  # 127 tests, requires the two test databases from .env.example
npm run lint            # strict TypeScript
npm run build           # production build
```

The suite runs against real PostgreSQL (never SQLite) and covers cross-tenant
isolation (candidate A vs candidate B, recruiter A vs recruiter B), authentication
lifecycle, job/application workflows, database constraint enforcement and config
hardening regressions.

## Architecture at a glance

* **Auth** — access token in memory (never localStorage) + rotating HttpOnly
  refresh cookie with reuse detection. Roles (`candidate` / `recruiter` /
  `admin`) are resolved from the database on every request; a forged JWT role
  claim grants nothing.
* **Authorization** — every protected operation resolves ownership from the
  caller's database row (membership → company, user id → profile). Foreign
  resources answer `404`, not `403`, so ids cannot be enumerated.
* **Validation** — Pydantic v2 schemas with `extra="forbid"` on all write paths.
* **Data** — FKs with `ON DELETE CASCADE`, `CHECK` constraints on enums and
  salary ranges, and a DB-level `UNIQUE (candidate_id, job_id)` that makes
  duplicate applications impossible even under a race.
* **Files** — resumes stored under opaque generated names, validated by magic
  bytes + extension + size, served only through an authenticated endpoint with
  `Content-Disposition: attachment` and `nosniff`.

Layout: `app/` (FastAPI: `api/v1`, `services`, `models`, `schemas`,
`security`, `db`) · `src/` (React SPA: `pages`, `hooks`, `services`,
`components`, `layouts`) · `alembic/` (migrations) · `tests/` (pytest).
