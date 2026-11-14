# HireFlow — Staging Deployment Plan

**Status:** preparation only. **Nothing has been deployed.** No hosting provider
is selected, no database is provisioned, and every deployment step below awaits
explicit approval.

Baseline this plan builds on (all verified, see `FINAL_READINESS_REPORT.md`):
127 backend tests passing · TypeScript passing · production build passing ·
`alembic check` reporting no drift · six cross-tenant isolation scenarios
passing · health endpoints verified live on a local instance.

---

## 1. Recommended architecture

```
                    ┌─────────────────────────────┐
   Browser ──TLS──▶ │  Static host / CDN          │  dist/ (React SPA)
                    │  SPA fallback → index.html  │  read-only, immutable assets
                    └──────────────┬──────────────┘
                                   │ fetch(), credentials:'include'
                                   │ Authorization: Bearer (in-memory)
                                   ▼
                    ┌─────────────────────────────┐
                    │  API host (uvicorn)         │  FastAPI, stateless
                    │  1–2 workers                │  RESUME_STORAGE_DIR on volume
                    └──────────────┬──────────────┘
                                   │ postgresql+psycopg:// … sslmode=require
                                   ▼
                    ┌─────────────────────────────┐
                    │  Managed PostgreSQL 14+     │  hireflow_staging
                    │  automated backups / PITR   │  hireflow_staging_test (CI)
                    └─────────────────────────────┘
```

Two independently deployable units (static SPA + stateless API), one managed
database. No message broker, no cache, no workers — the feature set needs none.

Two properties drive every recommendation below:

- **The API is stateless** — all session state is in PostgreSQL
  (`refresh_tokens`), so the API can be restarted, scaled horizontally, or
  replaced without logging anyone out.
- **Resume bytes live on a local volume** (`RESUME_STORAGE_DIR`), which is the
  *one* non-ephemeral requirement on the API host. On a container platform this
  must be a mounted volume, not container-local storage, or uploaded resumes
  vanish on redeploy.

## 2. Hosting options (no provider pre-selected)

Constraints honored: nothing is "already chosen"; free tiers are compared on
what HireFlow actually needs — a Python 3.11+ runtime, a persistent disk for
resumes, PostgreSQL 14+, TLS, and a static host for the SPA.

### API (FastAPI + uvicorn)

| Option | Free tier | Persistent disk for resumes | Fit |
|---|---|---|---|
| **Fly.io** | up to 3 tiny VMs | yes — mounted volume (small free allowance, then paid) | **Best fit.** Only option here with a genuinely free VM *and* a writable volume. Volume is the deciding factor |
| **Render** | free web service | no — free tier has ephemeral disk | Works, but resumes are lost on redeploy; would need a paid disk or an S3 swap (code change) |
| **Railway** | ~$5 trial credit, no permanent free VM | yes via volumes (paid) | Good DX; effectively paid after the trial |
| **Hetzner/DO VPS** | none (~$4–6/mo) | yes, whole disk | Cheapest at steady state; more ops (systemd, nginx, TLS via Caddy) |
| **Google Cloud Run** | generous free tier | no — container FS is ephemeral | Would require the S3 storage swap first |

**Recommendation:** Fly.io with a mounted volume for a first staging deploy, or
a small VPS if someone is comfortable with systemd + Caddy. **Do not** choose
Render's free tier or Cloud Run without first implementing the object-storage
path in `app/services/resumes.py` — that is a code change, not a config change.

### PostgreSQL

| Option | Free tier | Backups/PITR | Notes |
|---|---|---|---|
| **Neon** | free branch, ~0.5 GB | PITR on paid; free tier has restore points | DSN format already documented in `.env.example`; scale-to-zero is fine for staging |
| **Supabase** | free ~500 MB | daily backups | Also gives a storage bucket, useful later for S3-path resumes |
| **Managed on VPS** | bundled with VPS | manual/pgBackRest | Only with the VPS API option; more ops burden |

**Recommendation:** Neon free branch for staging — the connection-string shape
(`postgresql+psycopg://…?sslmode=require`) is already what the app expects.

### SPA

| Option | Free tier | Notes |
|---|---|---|
| **Cloudflare Pages / Netlify** | free | SPA fallback is one setting; global CDN |
| **GitHub Pages** | free | SPA fallback needs a 404.html copy hack; workable but clunkier |
| Same Fly.io/Render service | — | possible, but couples deploys; separate static host is cleaner |

**Recommendation:** Cloudflare Pages or Netlify.

### CI/CD

**GitHub Actions** — the repo is already on GitHub, and the four gates the plan
needs (`pytest`, `npm run lint`, `npm run build`, `alembic check`) map directly
onto Actions with no third-party service. Note: the backend test suite requires
a PostgreSQL service container (`postgres:16`) and a `_test`-suffixed database;
`.github/workflows/ci.yml` does **not exist yet** (see §10).

## 3. Required environment variables

Every variable verified against `.env.example` and `app/config.py`. **Where it
belongs:** `BE` = API host env; `FE` = build-time only (Vite inlines it into
`dist/` at build — changing it requires a rebuild, not a restart); `CI` = CI
secrets only, never runtime.

| Variable | Belongs | Purpose | Staging guidance |
|---|---|---|---|
| `ENVIRONMENT` | BE | Selects hardened behaviour | `staging` — disables docs/OpenAPI (verified live), enables secret validation |
| `NEON_DSN` | BE | PostgreSQL connection | `postgresql+psycopg://user:pass@host/db?sslmode=require`. The `+psycopg` scheme is mandatory; plain `postgresql://` fails |
| `SECRET_KEY` | BE | JWT signing | ≥32 chars, unique to staging, never shared with prod. Boot **fails** without it outside development |
| `CORS_ORIGINS` | BE | Exact allowed origins | The staging UI origin(s), comma-separated. `*` is rejected. Must list scheme+host+port exactly, else the refresh cookie is unusable |
| `RESUME_STORAGE_DIR` | BE | Resume file location | Path on a **persistent volume**, e.g. `/data/resumes`. Ephemeral container storage loses resumes on redeploy |
| `RESUME_MAX_BYTES` | BE | Upload cap | Default 10 MB is fine |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | BE | Access JWT lifetime | Default 15 (max 120) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | BE | Refresh lifetime | Default 30 |
| `REFRESH_COOKIE_SAMESITE` | BE | Cookie CSRF posture | `lax` (default). `none` requires `REFRESH_COOKIE_SECURE=true` and is validated |
| `REFRESH_COOKIE_SECURE` | BE | Cookie `Secure` flag | **Set `true` for staging** — the API will be behind TLS; leaving it unset auto-enables it outside development, but being explicit avoids surprises |
| `REFRESH_COOKIE_NAME` | BE | Cookie name | Default `hireflow_refresh` |
| `JWT_ISSUER` | BE | Token `iss` claim | Keep stable per environment; tokens from another issuer are rejected |
| `BCRYPT_COST` | BE | Hashing cost | 12 default; ≥10 for staging |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_RECYCLE_SECONDS` | BE | Pool tuning | Keep defaults for a free-tier DB (low `max_connections`) |
| `DB_ECHO` | BE | SQL logging | `false` — never `true` on a shared host |
| `ADMIN_EMAIL` | BE | Bootstrap admin identity | Used by `python -m app.cli create-admin` |
| `ADMIN_PASSWORD` | BE | Bootstrap admin password | Prefer omitting; the CLI prompts securely. Never commit |
| `RATE_LIMIT_AUTH_PER_MIN` | BE | Login/register budget | Default 10/min per IP+account |
| `RATE_LIMIT_PER_MIN` | BE | General request budget | Default 240/min |
| `S3_*` | BE | Future object storage | **Unused today** — boto3 is not installed. Leave blank |
| `VITE_API_BASE_URL` | FE | API base the SPA calls | Must be the **absolute public staging API URL** including `/api/v1`, e.g. `https://hireflow-api-staging.fly.dev/api/v1`. Inlined at build time |
| `TEST_DATABASE_URL` | CI | Test DB (must end in `_test`) | The suite refuses a non-`_test` database as a safety interlock |

**Not applicable:** nothing else is required. There is no Redis, no SMTP, no
external API key.

**Secret handling:** generate via `python -c "import secrets; print(secrets.token_hex(32))"`;
store in the platform's secret manager or GitHub Environment secrets; never in
the repo, never in `alembic.ini`, never in logs.

## 4. Database provisioning and migrations

1. Provision a managed PostgreSQL 14+ instance (Neon recommended, §2).
2. Create **two** databases: `hireflow_staging` (runtime) and
   `hireflow_staging_test` (CI — the suite requires the `_test` suffix as an
   interlock against wiping a real database).
3. Record the DSN in the platform secret manager as `NEON_DSN`. **Never commit
   it.** `.gitignore` already excludes `.env`.
4. Apply migrations **from a CI runner or admin workstation**, not as a side
   effect of app boot — the app never runs DDL at startup:

   ```
   alembic upgrade head          # idempotent; safe to re-run
   alembic current               # confirm the applied revision
   alembic check                 # confirm models and DB agree (no drift)
   ```

   `ALEMBIC_DATABASE_URL` overrides the DSN for migrations only, so CI can
   migrate the staging DB without touching app settings.
5. Create the bootstrap admin: `python -m app.cli create-admin` (prompts for a
   password; there is no public admin registration).
6. Verify objects exist: 15 tables + `alembic_version` (see §7 step 3).
7. **Backup policy:** enable managed backups/PITR *before* the first deploy, not
   after. Note that a database restore alone does **not** restore resumes —
   `RESUME_STORAGE_DIR` needs its own backup (§10).

## 5. Deployment sequence (for when approval is given)

Each step verifiable; nothing here runs automatically.

1. Provision DB + volume (§4).
2. Set backend secrets on the API host.
3. Deploy API: install deps → `alembic upgrade head` → start
   `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers
   --forwarded-allow-ips <proxy>`. **One worker for staging** — rate limiting is
   per-worker, so one worker makes limits exact (documented caveat).
4. Verify health (§7 steps 1–5).
5. Build SPA with the staging `VITE_API_BASE_URL`, then deploy `dist/`.
6. Configure the reverse proxy: TLS termination;
   `client_max_body_size 12m` (10 MB upload limit + headroom);
   forward `X-Forwarded-For`/`X-Forwarded-Proto`.
7. Create the first recruiter/candidate accounts and run the QA checklist (§9).
8. Enable log shipping and alerting on `/health/ready` != 200.

## 6. Security configuration for staging

| Control | Staging setting | Why |
|---|---|---|
| TLS | Required, terminated at proxy/platform | `REFRESH_COOKIE_SECURE=true` makes the refresh cookie HTTPS-only; without TLS the login flow is unusable by design |
| `ENVIRONMENT` | `staging` | Docs/OpenAPI disabled (verified), secret/CORS validation active |
| `CORS_ORIGINS` | Exact staging origins, no wildcard | Credentials-carrying CORS; a wildcard is rejected at boot and would also be rejected by browsers |
| Cookies | `HttpOnly`, `SameSite=Lax`, `Secure=true`, `Path=/api/v1/auth` | Defaults apply once `ENVIRONMENT != development`; `Secure` should be set explicitly |
| CSRF | `Origin`-checked on `/auth/refresh` and `/auth/logout` | Already implemented; no configuration needed, but the staging origin **must** be in `CORS_ORIGINS` or refresh will 403 |
| Rate limiting | 1 worker → exact limits | `RATE_LIMIT_AUTH_PER_MIN=10`, `RATE_LIMIT_PER_MIN=240` defaults |
| Docs/OpenAPI | Disabled automatically | Verified: `ENVIRONMENT=staging` yields `docs_url=None`, `redoc_url=None`, `openapi_url=None` |
| Security headers | Automatic | CSP, nosniff, DENY, no-referrer — verified live (§7 step 5) |
| Logging | No bodies, no query strings, no DSN | Already enforced in `app/main.py` |

**No auth/CSRF/isolation logic changes are required or proposed.**

## 7. Health-check and deployment verification procedures

Verified live against a locally running instance on 2026-11-14 (outputs shown
verbatim in the working notes of this session):

| Check | Command | Expected |
|---|---|---|
| 1. Liveness | `curl -s https://…/api/v1/health` | `{"status":"healthy","service":"hireflow-api"}` |
| 2. Readiness (DB) | `curl -s https://…/api/v1/health/ready` | `{"status":"ready","database":"ok"}` — **route traffic on this, not liveness** |
| 3. Schema | `alembic current` + `alembic check` | head revision; "No new upgrade operations detected" |
| 4. Docs closed | `curl -s -o /dev/null -w '%{http_code}' https://…/api/docs` | `404` |
| 5. Headers | `curl -sI https://…/api/v1/health` | `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer` present |
| 6. Unauthenticated guard | `curl -s -o /dev/null -w '%{http_code}' https://…/api/v1/auth/me` | `401` |
| 7. CORS preflight | `curl -s -X OPTIONS -H "Origin: <ui-origin>" -H "Access-Control-Request-Method: POST" https://…/api/v1/auth/login -D -` | `access-control-allow-origin: <ui-origin>` and `access-control-allow-credentials: true` |
| 8. Login + cookie | POST `/auth/login` | 200, body has `access_token`, `Set-Cookie` contains `hireflow_refresh=…; HttpOnly; Secure; Path=/api/v1/auth` |
| 9. SPA | open the UI origin | app loads; browser devtools show only calls to the API origin |
| 10. Full user flow | register recruiter → post job → register candidate → upload resume → apply → move stage → logout | logout must **invalidate** the access token: a later `/auth/me` with the old bearer returns 401 |

Monitoring: alert on `health/ready` != 200, and on 401/403/429 spikes (429
spikes indicate rate-limit tuning work; 401/403 spikes can indicate attack
traffic or a misconfigured origin).

## 8. Rollback procedure

**Code rollback:** redeploy the previous immutable build/image. The API is
stateless, so rollback is a redeploy, not a data operation. Sessions survive —
`refresh_tokens` lives in PostgreSQL, and a rollback does not change `SECRET_KEY`
so outstanding JWTs stay valid.

**Migration rollback:** `alembic downgrade -1` reverts one revision. Both
revisions in this repo are reversible (`downgrade()` implemented). **Check before
downgrading:** the baseline creates tables; the skill-ordering revision adds a
column and backfills it. Downgrading is safe only if the column's data is
disposable at that moment. When in doubt: do not downgrade; forward-fix with a
new revision.

**Bad-data rollback:** PITR to a restore point (Neon/managed provider), **plus**
restore `RESUME_STORAGE_DIR` from its backup — a DB-only restore silently loses
resume files uploaded after the restore point. Rehearse this once before go-live.

**Config rollback:** revert the env var change and restart; `VITE_API_BASE_URL`
is the exception — it is baked into `dist/`, so changing it requires a rebuild
and redeploy of the SPA.

## 9. Staging QA checklist

- [ ] `GET /health/ready` returns `{"status":"ready","database":"ok"}`
- [ ] `alembic current` = head; `alembic check` clean
- [ ] `/api/docs` returns 404
- [ ] Security headers present (§7 step 5)
- [ ] `/auth/me` without a token → 401
- [ ] CORS preflight from the UI origin succeeds; from a foreign origin it fails
- [ ] Login sets the refresh cookie with `HttpOnly`, `Secure`, `Path=/api/v1/auth`
- [ ] Register recruiter → company auto-created and unverified
- [ ] Register candidate → profile exists
- [ ] Candidate uploads a resume → downloadable by that candidate
- [ ] Uploading a renamed `.exe` / fake PDF → rejected with a clear message
- [ ] Candidate applies to a published job; duplicate apply → 409
- [ ] Candidate cannot apply without a resume (422 with a resume hint)
- [ ] Recruiter sees the applicant; moves stage Applied→Shortlisted→Interview
- [ ] Recruiter cannot read another recruiter's company/jobs/applicants
- [ ] Candidate cannot reach recruiter or admin endpoints (403)
- [ ] `/admin/*` rejects non-admins
- [ ] Logout invalidates the still-unexpired access token
- [ ] Public job board lists published jobs and hides drafts
- [ ] UI: no console errors on any page; network calls go only to the API origin

## 10. Outstanding blockers and approval requests

**Ready now (no work needed):**
- Application code, schema, and migrations (2 revisions, verified reversible).
- Complete env-var contract, validated at boot for staging.
- Health liveness + readiness endpoints (verified live, including a real DB check).
- Security headers, CORS, cookie attributes, CSRF origin checks — all verified.
- 127-test suite including all six isolation scenarios; suite refuses to run
  against a non-`_test` database (data-safety interlock).
- Deployment, rollback, and verification runbooks (this document + DEPLOYMENT.md).

**Missing before a staging deploy (needs building):**

| # | Item | Effort | Blocks deploy? |
|---|---|---|---|
| 1 | `.github/workflows/ci.yml` — pytest (with a `postgres:16` service), `npm run lint`, `npm run build`, `alembic check` | ~30 min | Not strictly, but it is the only automated gate for what gets deployed — **strongly recommended first** |
| 2 | Host account + project (Fly.io or VPS) and a Neon database | account setup | **Yes** |
| 3 | Platform secrets: `SECRET_KEY`, `NEON_DSN`, `CORS_ORIGINS`, `ADMIN_EMAIL` | minutes | **Yes** |
| 4 | Persistent volume mounted at `RESUME_STORAGE_DIR` | provider config | **Yes** (or accept resume loss on redeploy / swap to S3, which is a code change) |
| 5 | Backup enablement: Postgres PITR + resume-volume backup, then one restore rehearsal | provider config + 1 h | Not for first deploy; **required before go-live** |

**Requires explicit approval before I proceed:**

1. **Hosting selection** — which API host and database provider (recommendation: Fly.io + Neon).
2. **Domain names** for the staging API and UI (needed to finalise `CORS_ORIGINS` and `VITE_API_BASE_URL`).
3. **Creation of the staging database** (a real, persistent resource — outside the "no live DB changes" constraint until you approve it).
4. **Whether to add the CI workflow** (touches `.github/`, which may have branch-protection implications).
5. **Any actual deployment command** — none will be run until you say so.

Nothing in this plan has been executed beyond the read-only verifications noted.
