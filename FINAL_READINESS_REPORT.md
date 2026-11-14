# HireFlow — Final Release-Readiness Report

**Date:** 2026-11-14 · **Scope:** audit and documentation reconciliation only.
No security logic was modified. No production deployment or live-database change
was made. All commands were run on this workstation against the disposable local
PostgreSQL cluster (`tmp/pgdata`, port 5433); the user's own PostgreSQL service
was never touched.

---

## 1. Verification evidence (commands actually run)

| Gate | Command | Result |
|---|---|---|
| Backend tests | `python -m pytest -p no:warnings` | **127 passed, 0 failed** |
| Collection sanity | `pytest --co -q` | 34 + 34 + 31 + 22 + 6 = 127 collected across 5 modules |
| Frontend typecheck | `npm run lint` (`tsc --noEmit`) | **pass**, exit 0 |
| Production build | `npm run build` | **pass**, exit 0 (`dist/` emitted) |
| Migration drift | `python -m alembic check` | **"No new upgrade operations detected"** — schema and models in sync (exit 1 is Alembic's normal "no drift" convention) |
| Migrations apply | `alembic upgrade head` (twice) | idempotent; 15 tables + `alembic_version` confirmed via `psql` |
| Live API smoke | uvicorn on :8000 + scripted 53-check run (Phase 5, since removed) | all passed: register→login→job→resume→apply→stage→refresh→logout |

Static verification (no runtime claim):

- `grep localStorage.setItem|sessionStorage.setItem src/**` → **0 results**
  (also asserted by an automated test, `test_tokens_are_not_stored_in_browser_readable_storage`).
- Resume file naming/ownership verified by reading `app/services/resumes.py`;
  session revocation semantics by reading `app/services/session.py` and
  `app/security/deps.py`; header/CORS/cookie attributes by reading
  `app/security/middleware.py`, `app/security/cookies.py`, `app/config.py`.

## 2. The six cross-tenant isolation scenarios — verified

All six run against real PostgreSQL in `tests/test_security_isolation.py`
(34 tests including companions), each inside a rolled-back transaction:

| # | Scenario | Primary test(s) | Outcome |
|---|---|---|---|
| 1 | Candidate A → Candidate B's profile | `test_candidate_a_cannot_read_candidate_b_profile` (+update +resume, 3 tests) | 404/405; spoofed query params ignored; B's data unchanged |
| 2 | Candidate A → Candidate B's applications | `test_candidate_a_cannot_read_candidate_b_applications` (+on-behalf-of, 2 tests) | A's list empty; foreign id 403/404; injected `candidate_id` → 422 |
| 3 | Recruiter A → Recruiter B's company | `test_recruiter_a_cannot_read_recruiter_b_company` (+update, +jobs, +applicants, +resume, 5 tests) | `/companies/me` always self; drafts invisible; mutations 404 and data unchanged; resume gated on an actual application |
| 4 | Candidate performs recruiter-only operations | `test_candidate_cannot_perform_recruiter_operations` (+5 companions) | 403 on all attempted routes; job survives untouched |
| 5 | Unauthenticated access | `test_unauthenticated_requests_are_rejected` (9 routes) + write attempts | 401 everywhere; public board stays open |
| 6 | Expired/invalid sessions | 6 tests incl. a validly-signed expired token, wrong issuer, forged role claim, post-logout, deleted and suspended accounts | all rejected server-side |

**Convention asserted throughout:** foreign resources answer **404**, wrong-role
**403**, no/invalid credentials **401** — so responses cannot be used to
enumerate ids.

## 3. Inspection findings by area

| Area | Verdict | Notes |
|---|---|---|
| Authentication | **Sound** | bcrypt direct (passlib incompatibility documented in requirements.txt), 72-byte cap prevents hash collision, dummy-verify prevents account enumeration |
| Refresh rotation | **Sound** | digest-only storage, family revocation on replay, logout/password-change revoke live access tokens via `sid` |
| CSRF | **Sound for this design** | single HttpOnly cookie, path-scoped, `SameSite=Lax`; Origin-validated on `/auth/refresh` and `/auth/logout`; access token not a cookie and never in web storage |
| RBAC | **Sound** | role from DB per request; four dependency guards; ownership checks live in the service layer, not the router |
| Tenant isolation | **Sound** | all six scenarios pass; 404-vs-403 convention prevents enumeration |
| Resume handling | **Sound, two gaps** | magic-byte + extension + size validation, opaque keys, forced-attachment download, ownership-gated. Gaps: no virus scan, local-disk storage (documented) |
| Database constraints | **Sound** | uniqueness/CHECK/CASCADE all enforced at the schema level and proven by direct-INSERT tests that bypass the API |
| Frontend integration | **Sound** | single network layer, no token in storage, no client-supplied ownership ids, guards are correctly positioned as UX-only |
| Deployment config | **Adequate, with caveats** | see §5 |

**No defect was demonstrated that would justify modifying security logic**; per
the task constraints, no security code was changed in this pass.

## 4. Documentation reconciliation

`BACKEND_ARCHITECTURE.md` was rewritten to match the implementation. Principal
differences from the Phase 2 plan, all now recorded there:

| Phase 2 planned | Actually implemented |
|---|---|
| Passlib[bcrypt] | **bcrypt directly** (passlib 1.7.4 incompatible with bcrypt ≥4.1) |
| python-jose | **PyJWT** (jose was never installed) |
| FastAPI-Users | hand-rolled auth (rotating-token design) |
| SlowAPI | in-process fixed-window limiter (zero deps) |
| S3 presigned URLs | local volume + authenticated endpoint |
| HttpOnly access cookie | **in-memory access token + HttpOnly refresh cookie** |
| Synchronizer-token CSRF | **Origin validation** on the two cookie-bearing endpoints |
| `app/tests/` package | top-level `tests/` |
| `recruiters.py` router | merged into `jobs.py` / `companies.py` / `applications.py` |

Nothing unimplemented is described as existing; the status ledger in §6 of that
document marks email verification, password reset, virus scanning, S3,
Redis-backed rate limiting, OAuth, and admin audit logs as **NOT IMPLEMENTED**.

## 5. Deployment configuration review

**Verified:** `.env.example` documents every variable including `VITE_API_BASE_URL`
(build-time) and a `TEST_DATABASE_URL`; production boot fails fast without a real
`SECRET_KEY`, rejects placeholder/padded values, wildcard CORS, and `SameSite=None`
without `Secure`; `alembic.ini` contains no credentials (URL injected at runtime);
`.env` is gitignored; docs/OpenAPI auto-disabled outside development; both health
endpoints present, readiness performing a real `SELECT 1` and returning 503.

**Gaps / recommendations (not blockers for staging):**

1. **No CI pipeline file.** Recommend adding `.github/workflows/ci.yml` running
   `pytest`, `npm run lint`, `npm run build`, and `alembic check`.
2. **No containerfile / compose file.** Add when a target platform is chosen.
3. **Backup automation is documentation-only.** Postgres base backup + WAL (RPO
   ≤ 5 min) and a separate backup of `RESUME_STORAGE_DIR` must be configured on
   the hosting side; a DB restore alone loses resumes.
4. **Rate limiting is per-worker.** Exact limits require the Redis swap; or
   front the API with proxy-level `limit_req`.

## 6. Unresolved risks

| # | Risk | Severity | Mitigation status |
|---|---|---|---|
| 1 | No email verification → anyone can register any address | Medium | Documented; `is_verified` field ready. Blocker for a *public* launch, not for staging |
| 2 | No password reset by email | Medium | Documented; password change requires the current password |
| 3 | No virus scanning of resumes | Medium | Forced-attachment + `nosniff` + magic-byte checks reduce exposure; add ClamAV before public launch |
| 4 | Per-worker rate limiting | Low–Medium | Redis path documented; use proxy limits meanwhile |
| 5 | No SPA component/integration tests | Low | TypeScript strict + build gate cover types, not behaviour |
| 6 | Access-token window (~15 min) survives family-compromise until next refresh check on a state-changing route | Low | Standard JWT trade-off; revocation is checked on every authenticated request, so logout/deletion/suspension close it immediately |

## 7. Staging deployment checklist

Ordered; each step is verifiable.

1. **Provision** PostgreSQL 14+ and create two databases: `hireflow_staging`,
   `hireflow_staging_test`.
2. **Secrets:** generate per-environment values
   (`python -c "import secrets; print(secrets.token_hex(32))"`); store in the
   platform's secret manager — never in the repo.
3. **Configure `.env`** for staging: `ENVIRONMENT=staging`, real `NEON_DSN`
   (`postgresql+psycopg://…`), ≥32-char `SECRET_KEY`, exact `CORS_ORIGINS`
   (staging UI origin), `RESUME_STORAGE_DIR` on a persistent volume,
   `VITE_API_BASE_URL=https://api-staging…/api/v1`.
4. **Backend:** create venv → `pip install -r requirements.txt` →
   `alembic upgrade head` → `python -m app.cli create-admin`.
5. **Verify** `curl -s $API/api/v1/health/ready` returns
   `{"status":"ready","database":"ok"}` — not `/health`.
6. **Frontend:** `VITE_API_BASE_URL=… npm run build` → deploy `dist/` with SPA
   fallback; confirm `npm run lint` first.
7. **Proxy:** TLS termination, `client_max_body_size 12m`,
   `X-Forwarded-For`/`X-Forwarded-Proto` forwarded.
8. **Smoke test the real flow** in a private window: register recruiter → post
   job → register candidate → upload resume → apply → recruiter moves stage →
   logout → confirm refresh fails afterwards.
9. **Run the isolation suite** against staging credentials from a CI runner.
10. **Enable backups:** Postgres base backup + WAL with documented RPO/RTO, plus
    a scheduled backup of the resume volume; rehearse a restore before go-live.
11. **Log/alert:** ship stdout to the log platform; alert on
    `/health/ready` != 200 and on 401/403/429 spikes.

---

### Sign-off

Release-readiness gates: backend tests ✅ · typecheck ✅ · production build ✅ ·
migration drift ✅ · six isolation scenarios ✅. HireFlow is **ready for staging**.
It is **not** ready for a public production launch until email verification,
password reset, and resume virus scanning are implemented — each is scoped in
DEPLOYMENT.md §8 and deliberately not claimed as done anywhere in the docs.
