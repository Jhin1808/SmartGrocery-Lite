# Design and integration review

The redesign is on `design/hallmark-live`, based on current GitHub `origin/main`. Earlier work is retained on `design/hallmark-market`. No merge, deployment or production data change was made.

## Checks

- Production frontend build passes with `GENERATE_SOURCEMAP=false`; the unmodified barcode package ships missing source maps, which otherwise produces dependency warnings.
- Frontend: all 18 tests pass, including inventory persistence and missing-ingredient UI tests.
- Backend: the existing suite plus fridge tests passes (104 tests at the full-suite run); the subsequently added foreign-list permission check also passes. Final targeted fridge/recipe checks: 16 passed, including the new permission and unpurchased-state assertions.
- Fridge migration upgrade and downgrade tested against isolated SQLite. PostgreSQL-specific RLS/grants mirror the existing deployment security model; not applied to the live database.
- Browser: login, registration mode, list creation, grocery item creation, inventory creation, real meal search, missing-to-list, account, stores and templates checked. Desktop and 390px mobile screenshots inspected. No JavaScript errors observed; no horizontal overflow on checked mobile screens.
- Real local backend calls: TheMealDB chicken search returned 20 recipes; fridge suggestions returned 8 detailed matches; Open Food Facts barcode `3017620422003` returned Nutella; taxonomy returned 20 groups; templates returned 7 records.
- Local Kroger status: configured=false. No local developer credentials were supplied.
- Live API: reachable at https://api.tobuylists.com; registration CORS preflight and reset configuration return 200 with the correct production origin. Live preview login returns 401. The user also reported difficulty signing in; the visible live registration attempt showed “Failed to fetch”. An authenticated Kroger search/price request could not be verified. This is a recorded limitation, not a passing live Kroger test.
- Google OAuth and password-reset delivery were not end-to-end tested. Existing integrations remain in place.

## Design

Paper surfaces, forest-green ink, locally hosted Fraunces and IBM Plex Sans, real market photography and a clearly labelled grocery example connect the public pages to the shared-kitchen purpose. The workspace prioritizes list actions. Templates use useful ingredient counts instead of decorative emoji panels. Fridge matching is conservative and explicitly asks cooks to check quantities. No generated testimonials, metrics, gradients, or AI service is used.

## Local preview

Frontend: http://localhost:3000, using `REACT_APP_API_BASE=http://localhost:8000`.
Backend: isolated `backend/.hallmark-preview-live.db`; local HTTP cookies use `COOKIE_SECURE=false` and `COOKIE_SAMESITE=lax`. Production cookie configuration is unchanged. Runtime and preview databases are excluded from Git.

Deployment requires `alembic upgrade head` on the backend before publishing the new fridge route. Production rollout is outside this branch-only task.
