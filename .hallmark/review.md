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

## Follow-up live registration and Kroger verification

On 2026-09-30, after the user approved accepting the site's Terms and Privacy Policy, a fresh synthetic test account was created successfully through the production registration page. The browser signed in and reached /lists. No registration failure reproduced with this new account; the earlier “Failed to fetch” cause remains unknown.

ZIP 90210 returned 10 real Kroger-family/Ralphs stores. The test account connected to Ralphs Fresh Fare - Beverly Doheny, location 70300724, at 9040 Beverly Blvd, West Hollywood, CA 90048. Production login, Kroger status (configured=true), store search and connected-store endpoints returned HTTP 200.

Live catalog checks found a separate existing issue: generic OFF results filled the result limit before Kroger products, and a specific Kroger milk query returned products with null regular/promo prices. Source inspection confirmed price/inventory/fulfillment are read from the product root instead of the sellable item variant. Kroger's official workspace example documents the variant fields: https://www.postman.com/kroger/the-kroger-co-s-public-workspace/request/4soeap9/product-details

The design branch now prioritizes connected-store products, replaces same-code generic duplicates, reads variant prices/inventory/fulfillment, and accepts the single-object product-detail response. Kroger cache keys are versioned to avoid retaining earlier unpriced payloads after rollout. Ten targeted catalog/Kroger tests pass. These fixes have not been deployed; production price display is still unverified after the fix.

The live test account and its connected store remain available for follow-up. No purchase or user grocery list was created.

## Simplified recipe kitchen

The fridge page now centers on recipes: a grouped common-ingredient checklist saves automatically, one field adds other foods, and one recipe search accepts either the saved checklist or a dish name. Quantity and date forms are removed from this screen. Existing expired inventory is excluded and remains visible in a collapsed cleanup section. Recipe results show available/missing ingredients and retain the permission-checked add-missing-to-list action.

Verification: all 19 frontend tests pass; all five fridge backend tests pass; the production frontend build succeeds. Browser checks saved chicken, rice and mushrooms, returned 11 real checklist-based recipes, and found Spicy Arrabiata Penne by name. The 390px mobile layout has no horizontal overflow. Desktop and mobile screenshots were inspected.

## Demo and shopping readability fixes

Demo Stores and Templates render a clear account-required notice before mounting account-only API consumers. Regression tests verify that neither feature sends authenticated API calls in demo mode. Demo entry copy describes the available sample list/shopping features. Shopping quantity decorations are removed. Shopping cards give product text a full-width column, use normal word wrapping, and move expiry badges below the main content. Mobile browser verification shows Chicken breast intact with Qty 2 and no clipped badge. All 21 frontend tests pass; the production build succeeds.
