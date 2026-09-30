# ToBuyLists design system

Audience: households and roommates. Primary action: create and use shared grocery lists. Approved tone: warm editorial, inspired by a neighborhood food market.

Hallmark reference: https://github.com/nutlope/hallmark (multi-page redesign workflow). Garden theme adapted to the existing React/Bootstrap application. Preserve route ownership, authentication, sharing permissions, and API contracts.

## Shared system

- Marketing: product-led Workbench variation, with a grocery-list example layered over market photography; N9 edge-aligned navigation and Ft1 mast-headed footer.
- Application: functional list workbench, with a list selector and a working sheet. No decorative imagery inside the workspace.
- Authentication: editorial introduction beside the form; form first on phones.
- Content: readable document layout using the same type and color tokens.
- Display: Fraunces 300; wordmark and list titles 600. Body: IBM Plex Sans 400/500/600. Locally hosted fonts with system fallbacks.
- Paper `oklch(96.8% .014 100)`, sheet `oklch(99% .008 100)`, ink `oklch(28% .045 155)`, secondary ink `oklch(46% .025 145)`, accent `oklch(37% .065 151)`, rule `oklch(83% .023 110)`.
- Canonical tokens and Bootstrap adapters: `frontend/src/market.css`. Preserve previous entry stylesheets; import the new layer last.
- Four-point spacing scale, fluid display type, small button radii, quiet dividers. No gradients, glass, emoji feature grids, invented statistics, or unsupported product claims.
- Motion: purposeful button press only, disabled for reduced motion. Instant keyboard focus outline. Minimum 44px form/button controls.
- Copy: concrete household language. Example content is explicitly marked and never inserted into real accounts.
- Existing destructive confirmations stay because the backend offers no undo endpoint.

## Route inventory

`/`: public landing, authenticated users continue to `/lists`.
`/login`: sign-in and account creation, including Google sign-in.
`/reset`: password request/reset; `/oauth/callback`: existing sign-in completion.
`/lists`: grocery workspace; `/lists/:id`: direct list detail.
`/account`: profile and password; `/help`: support; `/terms`: terms.

## Assets

Market image: https://images.unsplash.com/photo-1542838132-92c53300491e (Unsplash, locally hosted).
Fonts: Fraunces and IBM Plex Sans via Google Fonts, SIL Open Font License; source stylesheet retained in `frontend/public/fonts/fonts-source.css`.

## Current GitHub application

This implementation is based on `origin/main`, on `design/hallmark-live`. The earlier ZIP-based work is retained on `design/hallmark-market`.

`market.css` provides the shared tokens and public pages; `live-market.css` adapts the current CRA workspace, store, recipe, template and account surfaces. Existing catalog, barcode, sharing, recipe and template functionality remains in place.

My fridge is a personal, backend-persisted inventory. TheMealDB suggestions exclude past use-by items, compare conservative ingredient names, and list available and missing ingredients. Quantities must be checked by the cook. Adding missing ingredients enforces list edit permissions and skips ingredients already on the list. No AI service is used.

The new Alembic migration adds the inventory table and applies the deployed Supabase access restrictions. Deploy the backend migration before enabling the frontend route in production. Never merge or deploy from this task without a separate request.

## Recipe kitchen simplification

`/fridge` is a recipe worksheet: check common ingredients, add another food in one field, then find recipes using that checklist or a dish name. A compact paper surface and grouped checkboxes keep the work visible without inventory management forms. Saved foods remain personal and backend-persisted; expired foods do not count toward recipe matches. Recipe cards retain ingredient details, source links, and adding missing foods to an editable grocery list.
