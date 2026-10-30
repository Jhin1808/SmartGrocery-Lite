# Everyday groceries

The signed-in **Everyday** page provides personal staples, recent purchases, groceries to use first, and a manual weekly restock. It is also linked from Shopping lists. Demo mode stays a simple paper-style list.

- Pin a grocery and quantity as a staple. “We’re out” adds it to the selected editable list.
- Check a grocery off as bought in a shopping list to record it in **Buy again**. History is private to the account doing the checkoff, survives deletion of the original item, and starts recording after this release. Demo imports also record explicitly checked-off items.
- **Restock staples** adds missing names, restores bought matches and clears their old expiry/reminder dates. Existing pending groceries and unrelated items are preserved. A list-level PostgreSQL row lock serializes shortcut writes. The page indicates whether the account has restocked that list in the current Monday–Sunday week. It never schedules automatic changes.
- **Use first** shows bought groceries from accessible lists with entered expiry dates up to three days ahead, including past dates. Its feed spans accessible lists; the destination selector applies to additions/restocking. Dates are user-entered, not a food-safety determination. Find recipes opens ingredient search.
- **Keep this list** in demo stages only the selected list, including checked-off state, in session storage for that browser tab. Nothing is sent until sign-in/account creation completes. The signed-in app waits for import before loading lists. Failed imports retain the draft with retry/continue choices. A UUID import key is scoped to the receiving account and makes repeat requests safe. Refreshing the original demo still resets its in-memory edits unless Keep this list was explicitly chosen. Closing the tab can discard a staged draft. Maximum: 200 items per imported list.

## Deployment

Deploy the backend with migration `2026_10_30_everyday` before the frontend. The normal `backend/start.sh` already runs `alembic upgrade head`. For a custom startup command, run it from `backend/` with the deployment's existing DATABASE_URL before starting the API.

The migration creates `staple`, `purchase_history`, `restock_run`, and `demo_import`, with ownership foreign keys and uniqueness constraints. PostgreSQL tables use RLS and revoke browser-role access; the Supabase service role receives table/sequence privileges when present. Use the backend database owner/service role, as with the existing app. Never put database credentials in frontend variables.

The frontend uses its existing `REACT_APP_API_BASE`; no new secrets or services are needed. The `/everyday` Vercel rewrite and noindex response header are included. Normal signup and Google OAuth use the existing authentication configuration.

## Validation

From backend: `../.venv/bin/python -m pytest app/tests -q`

From frontend: `CI=true npm test -- --watchAll=false --runInBand`, then `npm run build`.

Tests cover account isolation, viewer/editor permissions, normalized duplicate names, deleted purchase sources, restock retries/date clearing, import validation/idempotency and checkoffs, SQLite migration execution/rollback, PostgreSQL migration SQL generation, frontend destination failures and retry, and signup transfer state. PostgreSQL SQL generation is checked; a live PostgreSQL deployment is not created by these tests.
