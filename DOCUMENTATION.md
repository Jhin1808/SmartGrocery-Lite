# SmartGrocery-Lite — Technical Documentation

> **Full-Stack Grocery List Web Application** — v1.0 — Generated May 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Frontend Architecture](#2-frontend-architecture)
   - [Entry Point](#21-entry-point)
   - [App Component & Routing](#22-app-component--routing)
   - [Auth Context](#23-auth-context)
   - [API Client](#24-api-client)
   - [Pages Reference](#25-pages-reference)
   - [Shared Components](#26-shared-components)
3. [Backend Architecture](#3-backend-architecture)
   - [Application Factory](#31-application-factory)
   - [Database Layer](#32-database-layer)
   - [Configuration](#33-configuration)
   - [Security Layer](#34-security-layer)
   - [Auth Dependencies](#35-auth-dependencies)
   - [Cookie Management](#36-cookie-management)
   - [Rate Limiting](#37-rate-limiting)
   - [Permissions](#38-permissions)
   - [Email Integration](#39-email-integration)
   - [Pydantic Schemas](#310-pydantic-schemas)
   - [SQLAlchemy Models](#311-sqlalchemy-models)
   - [Routers](#312-routers)
   - [Test Suite](#313-test-suite)
4. [Infrastructure](#4-infrastructure)
5. [Data Flow](#5-data-flow-request-lifecycle)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Expansion Points & Feature Roadmap](#7-expansion-points--feature-roadmap)

---

## 1. System Architecture Overview

```
+----------------------------------------------------------------------+
|                        SmartGrocery-Lite                             |
|                                                                      |
|  +-----------------+     +----------------------------------------+  |
|  |   Frontend CDN   |     |        API Hosting                      |  |
|  |                  |     |                                        |  |
|  |                  |     |                                        |  |
|  |                  |     |  +----------------------------------+  |  |
|  |  React SPA       |     |  |       FastAPI Application         |  |  |
|  |  (static files)  |<--->|  |                                  |  |  |
|  +-----------------+     |  |  +------------+  +-------------+  |  |  |
|                          |  |  | Routers    |  | Middleware   |  |  |  |
|  +-----------------+     |  |  | auth.py    |  | CORS         |  |  |  |
|  | Vercel Functions |     |  |  | lists.py   |  | Session      |  |  |  |
|  | (api/ directory) |     |  |  | tasks.py   |  | CSRF-check   |  |  |  |
|  |                  |     |  |  | me.py      |  +-------------+  |  |  |
|  | cron-run-remind- |     |  |  | google.py  |                  |  |  |
|  | ers.js           |---->|  |  +------------+                  |  |  |
|  | resend-upsert.js |     |  |       |                           |  |  |
|  | send-reset-code  |     |  |  +----+------+  +--------------+  |  |  |
|  +-----------------+     |  |  | SQLAlchemy|  | PostgreSQL    |  |  |  |
|                          |  |  | Models    |  | Database      |  |  |  |
|  +-----------------+     |  |  +-----------+  +--------------+  |  |  |
|  | GitHub Actions   |     |  |                                    |  |
|  | (reminders cron) |---->|  +------------------------------------+  |
|  +-----------------+     +-------------------------------------------+
|  +--------------------------------------------------------------+
|  |       Cloudflare Pages Functions (backup reminders)            |
|  +--------------------------------------------------------------+
+----------------------------------------------------------------------+
```

| Deployment | URL |
|---|---|
| Frontend | Stored locally only; see `DEPLOYMENT_URLS.local.md` |
| Frontend alternate | Stored locally only; see `DEPLOYMENT_URLS.local.md` |
| Backend API | Stored locally only; see `DEPLOYMENT_URLS.local.md` |

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Bootstrap 5 / React-Bootstrap |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic, Authlib |
| Auth | Argon2id + JWT (PyJWT) + Google OAuth 2.0 |
| Email | Resend API (+ SMTP fallback) |
| Database | PostgreSQL (via Supabase) |
| Hosting | Vercel (frontend), Koyeb (backend), Cloudflare Pages (backup) |

### Key Design Decisions

- **Cookie-primary auth:** JWTs in `HttpOnly`, `Secure`, `SameSite=lax` cookies; no token exposed to JavaScript by default.
- **Bearer fallback:** Opt-in (env flag) for Safari/ITP cross-site cookie blocking scenarios.
- **Triple-redundant reminders:** Vercel Cron + Cloudflare Pages Functions + GitHub Actions all trigger the same secured backend endpoint.
- **Vercel relay functions:** Resend API keys live only in Vercel environment; backend calls relay functions, never exposes keys directly.

---

## 2. Frontend Architecture

### 2.1 Entry Point

`frontend/src/index.js`

```
index.js
  ├── imports: React, ReactDOM, App, bootstrap CSS, custom styles
  ├── reportWebVitals()  (CRA default; no-op without callback)
  └── ReactDOM.createRoot → <React.StrictMode> → <App />
```

### 2.2 App Component & Routing

`frontend/src/App.js`

**Component Tree:**

```
<App>
  └── <AuthProvider>            ← React Context: { user, loading, refresh, logout }
      └── <BrowserRouter>
          └── <AppShell>
              ├── <NavBar />            ← lazy-loaded, sticky; user dropdown or "Sign in"
              └── <Routes>
                  ├── /          → Redirect to /lists (auth'd) or /login (guest)
                  ├── /login     → <EnhancedAuthTabs />      PUBLIC
                  ├── /oauth/callback → <OAuthCallback />    PUBLIC
                  ├── /reset     → <ResetPassword />         PUBLIC
                  ├── /terms     → <Terms />                 PUBLIC
                  ├── /lists     → <RequireAuth> → <EnhancedLists />    PROTECTED
                  ├── /lists/:id → <RequireAuth> → <ListDetail />      PROTECTED
                  ├── /account   → <RequireAuth> → <Account />         PROTECTED
                  ├── /help      → <RequireAuth> → <Help />            PROTECTED
                  └── *          → Redirect to /lists
```

**Code splitting:** Every page component uses `React.lazy()`. Bootstrap Icons CSS is dynamically imported only after a user is authenticated, reducing the initial payload for the login route.

**`RequireAuth` guard:**
- If `loading === true` → render nothing (prevents flash)
- If `!user` → redirect to `/login` with `state.from` preserving the attempted URL

### 2.3 Auth Context

`frontend/src/pages/AuthContext.jsx`

**Provider: `AuthProvider`**

| State | Type | Description |
|---|---|---|
| `user` | `object\|null` | Current user from `GET /me` |
| `loading` | `boolean` | True during initial auth check |

| Method | Signature | Description |
|---|---|---|
| `refresh` | `() => Promise<void>` | Calls `GET /me`; sets user or null. `loading=false` in `finally` |
| `logout` | `() => Promise<void>` | Clears localStorage fallback token, calls `POST /auth/logout`, sets user=null |

**Auto-refresh behavior:** On mount, skips `/me` call on public routes (`/login`, `/oauth/callback`, `/reset`, `/terms`) to avoid unnecessary 401s.

**Consumer hook:** `useAuth()` returns `{ user, loading, refresh, logout }`.

### 2.4 API Client

`frontend/src/api.js`

#### Core `request()` Function

```
async function request(path, { method = "GET", headers = {}, body } = {}) {
  // 1. Build URL: joinUrl(API_BASE, path)
  // 2. Conditionally attach Bearer token from localStorage (opt-in only)
  // 3. Auto-serialize JSON body if not FormData
  // 4. fetch() with credentials: "include" (sends cookies cross-origin)
  // 5. Handle 204 No Content → return null
  // 6. On error: parse JSON detail/message, or fallback to text → throw Error with .status
  // 7. On success: parse JSON or return text
}
```

#### API Function Catalog (23 functions)

| Function | Method | Endpoint | Auth? |
|---|---|---|---|
| `apiLogin(email, pwd)` | POST (form) | `/auth/token` | No |
| `apiLogout()` | POST | `/auth/logout` | Cookie |
| `apiRegister({email,pwd})` | POST | `/auth/register` | No |
| `apiMe()` | GET | `/me` | Cookie/Bearer |
| `apiUpdateMe(patch)` | PATCH | `/me` | Cookie/Bearer |
| `apiChangePassword({current,new})` | POST | `/auth/change-password` | Cookie/Bearer |
| `apiForgotPassword(email,captcha)` | POST | `/auth/forgot-password` | No |
| `apiResetPassword({...})` | POST | `/auth/reset-password` | No |
| `apiGetLists(includeHidden)` | GET | `/lists/` | Cookie/Bearer |
| `apiCreateList(name)` | POST | `/lists/` | Cookie/Bearer |
| `apiRenameList(id, name)` | PATCH | `/lists/{id}` | Cookie/Bearer |
| `apiDeleteList(id)` | DELETE | `/lists/{id}` | Cookie/Bearer |
| `apiGetItems(listId)` | GET | `/lists/{id}/items` | Cookie/Bearer |
| `apiAddItem(listId, {...})` | POST | `/lists/{id}/items` | Cookie/Bearer |
| `apiUpdateItem(itemId, patch)` | PATCH | `/lists/items/{id}` | Cookie/Bearer |
| `apiDeleteItem(itemId)` | DELETE | `/lists/items/{id}` | Cookie/Bearer |
| `apiHideList(id)` | POST | `/lists/{id}/hide` | Cookie/Bearer |
| `apiUnhideList(id)` | DELETE | `/lists/{id}/hide` | Cookie/Bearer |
| `apiLeaveSharedList(id)` | POST | `/lists/{id}/share/leave` | Cookie/Bearer |
| `apiListShares(listId)` | GET | `/lists/{id}/share` | Cookie/Bearer |
| `apiCreateShare(listId,{email,role})` | POST | `/lists/{id}/share` | Cookie/Bearer |
| `apiUpdateShare(listId,sid,{role})` | PATCH | `/lists/{id}/share/{sid}` | Cookie/Bearer |
| `apiRevokeShare(listId,sid)` | DELETE | `/lists/{id}/share/{sid}` | Cookie/Bearer |
| `googleLoginUrl()` | GET | `/auth/google/login` | No |

### 2.5 Pages Reference

#### EnhancedLists.jsx (1473 lines — Main Application View)

**State architecture:**

```
lists: []                    -- all list metadata (owned + shared)
selectedId: number|null      -- currently selected list
listQuery: ""                -- left-pane search filter
listSort: {key, dir}         -- left-pane sort config
itemsByList: {}              -- { [listId]: Item[] } — per-list item cache
loadingItems: Set<number>    -- which lists are currently fetching

filters: {}                  -- { [listId]: string } — per-list item search text
sortBy: {}                   -- { [listId]: {key, dir} } — per-list sort config
drafts: {}                   -- { [listId]: draft } — add-item form state
editing: Set<number>         -- which item ids are in inline-edit mode
editDrafts: {}               -- { [itemId]: editState } — inline edit drafts
expandedIds: Set<number>     -- which items have their description expanded

shoppingMode: false          -- toggle shopping checklist view
hidePurchased: true          -- hide checked items in shopping mode
showHidden: false            -- show hidden shared lists

confirmDel: null             -- confirm-delete-item modal state
confirmDelList: false        -- confirm-delete-list modal state
shareOpen: false             -- share modal visibility
shares: []                   -- current list's shares
toast: null                  -- notification toast state
```

**Key behaviors:**

- **Caching:** Module-level `__listsCache` and `__itemsCache` (on `window.*`) avoid re-fetching on back-navigation. Cache keys on window scope support auth-scope clearing.
- **Optimistic updates:** `togglePurchased` updates local state immediately, then calls API. On failure, reverts.
- **Undo support:** After toggling purchased, shows toast with "Undo" button. Tracks `lastToggle` state for reversion.
- **Shopping mode:** Displays items as cards (Bootstrap grid), with progress bar tracking % purchased. `hidePurchased` checkbox filters out done items.
- **Left pane:** List search, sort by name/created/items/pending, toggle hidden, item counts, create-new-list form.
- **Right pane:** Add-item form (name, qty, expiry date, description textarea), item search filter, sort toggle, table view with inline editing, expandable item descriptions.
- **Sharing:** Modal with invite-by-email, role select (viewer/editor), role change, revoke.
- **Non-owner actions:** Hide/unhide toggle, "Remove" button (calls leave + local blacklist via `sg-removed-lists` in localStorage).

**Expiry helpers:**

- `parseDate(s)` → `new Date("YYYY-MM-DDT00:00:00")`
- `daysUntil(s)` → number of days from now (negative = expired)
- `ExpiryBadge` → color-coded: green (fresh), warning (≤3 days / today), danger (expired)
- `ExpiryDot` → small colored dot for visual expiry scan

#### EnhancedAuthTabs.jsx (565 lines — Styled Login/Register)

- **Login:** email + password + show/hide toggle + "Remember me" (UI-only)
- **Register:** email + password + confirm + agree terms
- **Password strength:** 0-4 scale (length ≥8, mixed case, digit, special char) with visual bar
- **Google OAuth:** Redirects browser to `/auth/google/login`
- **Flow:** `apiLogin()` → store fallback token → `refresh()` → navigate to `/lists`

#### OAuthCallback.jsx (48 lines)

1. Check URL hash for `#access_token=...` (Safari/ITP fallback)
2. If found + `AUTH_HEADER_FALLBACK_ENABLED` → store in `localStorage`
3. Strip fragment via `history.replaceState`
4. Call `refresh()` (backend cookie was set on redirect response)
5. Navigate to `?next=...` or default to `/lists`

#### ListDetail.jsx (239 lines)

Standalone individual list page at `/lists/:id`:
- Loads items via `apiGetItems(id)`
- Add-item form (name, qty, expiry)
- Inline editing (single item at a time)
- Filter: All / Fresh / Expired
- Sort: name / quantity / expiry, asc/desc toggle
- Delete single or "Clear All" (batch delete)

#### Account.jsx (304 lines — Profile + Password)

**Tabs:**

1. **Profile:** Editable name (max 120 chars), profile picture URL with client-side sanitization (only http/https/blob URLs; data URLs limited to PNG/JPEG/GIF/WebP; rejects SVG and `<script>` injections). Avatar preview with `onError` fallback. "Save changes" only when dirty. "Reset" button reverts to server values.
2. **Security:** Change password. Current password optional (SSO-only users can set first password). Min 8 chars. Confirm password with inline validation. `autoComplete` attributes for password managers.

#### ResetPassword.jsx (210 lines)

**Two modes:**

1. **Request mode** (no token in URL): Email input + Cloudflare Turnstile CAPTCHA. Calls `POST /auth/forgot-password`. Shows dev code if backend sends it. Manual code paste UI.
2. **Reset mode** (token or code in URL): Two password fields. Code flow shows email field. JWT flow uses legacy link.

**Turnstile component:** Embedded widget renderer. Loads Cloudflare script dynamically, renders with `sitekey` from `REACT_APP_TURNSTILE_SITE_KEY`.

#### Other Pages

| Page | Lines | Purpose |
|---|---|---|
| `AuthTabs.jsx` | 205 | Simpler auth UI (plain HTML, no React-Bootstrap) |
| `Terms.jsx` | 63 | Static Terms of Service |
| `Help.jsx` | 14 | Minimal usage instructions |
| `Lists1.0.jsx` | 184 | Legacy accordion-style list display |

### 2.6 Shared Components

#### NavBar.jsx (92 lines)

- Sticky-top Bootstrap Navbar
- Brand logo + "SmartGrocery Lite" text
- Conditional nav links (Lists, Account, Help) only when authenticated
- User dropdown: avatar (ui-avatars.com fallback), profile link, sign out
- `ThemeToggle` component
- Sign-in button (shown on non-login routes when unauthenticated)

**Avatar sub-component:** Renders user picture or `ui-avatars.com` generated initials. Handles `onError` gracefully.

#### ThemeToggle.jsx (38 lines)

- Toggles between `light` and `dark` themes
- Persists to `localStorage` key `sg-theme`
- Sets `data-theme` and `data-bs-theme` attributes on `<html>` for CSS and Bootstrap 5.3 variable switching
- Renders sun/moon Bootstrap Icon

---

## 3. Backend Architecture

### 3.1 Application Factory

`backend/app/main.py`

**Startup sequence:**

1. Load `FRONTEND_URL` from env → produce `ALLOWED_ORIGINS` list (comma-separated support)
2. Load `SESSION_SECRET` via `load_secret()` (enforces strong secrets in production)
3. Load `COOKIE_SAMESITE` (default: `lax`), `COOKIE_SECURE` (default: `false`)
4. Enforce: if `SameSite=None`, force `Secure=true`
5. Create `FastAPI` instance
6. Register middleware in order: CORSMiddleware → SessionMiddleware → CSRF middleware
7. Conditionally register routers (Google OAuth and email_test skip on import failure)

**CSRF middleware (`reject_cross_site_cookie_mutations`):**

- For unsafe methods (POST, PUT, PATCH, DELETE, etc.), checks that requests with auth cookies come from allowed origins
- Skips if `Authorization: Bearer` header is present (native mobile clients)
- Validates origin against: `Origin` header, `Referer` header, `x-forwarded-proto` + `x-forwarded-host` (proxy support), current server origin

### 3.2 Database Layer

`backend/app/database.py`

**`build_db_url()`:** Constructs PostgreSQL connection string. Priority: `DATABASE_URL` env → discrete `PG*` environment variables. Auto-appends `sslmode=require` for Supabase URLs. Normalizes `postgres://` to `postgresql://`.

**Connection pooling:**
- Supabase → `NullPool` (open/close per request, compatible with PgBouncer)
- Otherwise → `QueuePool` with `pool_size` (default 1) and `max_overflow` (default 0)
- `DB_DISABLE_POOL` env var can override auto-detection

**`get_db()`:** FastAPI dependency generator. Creates session, yields, closes in `finally`.

### 3.3 Configuration

`backend/app/config.py`

| Function | Signature | Purpose |
|---|---|---|
| `env_flag` | `(name, default=False) → bool` | Parse "1"/"true"/"yes"/"on" as True |
| `is_production_like` | `() → bool` | True if REQUIRE_STRONG_SECRETS, ENV=prod/staging, or public FRONTEND_URL |
| `load_secret` | `(primary, fallback, dev_default, min_length=32) → str` | Load secret; in prod: reject defaults, enforce min length |
| `get_frontend_url` | `() → str` | Canonical frontend URL (auto-https for non-localhost) |

### 3.4 Security Layer

`backend/app/security.py`

**Password hashing:** Argon2id via `argon2-cffi` library.
- `hash_password(plain) → str`
- `verify_password(plain, hashed) → bool` (returns False on mismatch, doesn't raise)

**JWT management (PyJWT):**

| Function | Description |
|---|---|
| `create_access_token(subject, expires_minutes)` | JWT with `sub` + `exp` (default 60 min) |
| `decode_token(token)` | Payload dict; raises on invalid/expired |
| `create_purpose_token(subject, purpose, expires)` | JWT with `sub`, `exp`, `purpose`, `jti` (secrets.token_urlsafe 8) |
| `create_reset_token(subject, expires=30)` | Convenience wrapper: purpose="reset" |
| `decode_reset_token(token)` | Validates purpose="reset", returns payload |

**Key loading:** `SECRET_KEY` loaded via `load_secret()` with fallback to `JWT_SECRET_KEY` or `JWT_SECRET`.

### 3.5 Auth Dependencies

`backend/app/deps.py`

All strategies backed by shared `_user_from_token(token, db)` which decodes JWT and loads User.

| Dependency | Token Source | Error |
|---|---|---|
| `get_current_user` | `Authorization: Bearer` (OAuth2PasswordBearer) | 401 |
| `get_current_user_bearer` | `Authorization: Bearer` (HTTPBearer, auto_error=False) | 401 |
| `get_current_user_cookie` | `access_token` cookie (HttpOnly) | 401 |
| **`get_current_user_any`** | Tries Bearer first, falls back to cookie | 401 if both fail |

`get_current_user_any` is the primary dependency used by all routers. It handles Safari/ITP scenarios where cross-site cookies may be blocked by preferring a Bearer token when present.

### 3.6 Cookie Management

`backend/app/security_cookies.py`

**`set_login_cookie(response, token)`:**
- Sets `HttpOnly` cookie named `access_token` (configurable via `AUTH_COOKIE_NAME`)
- `Secure` flag: defaults to `true` (production); enforced if `SameSite=None`
- `SameSite`: defaults to `"none"` (cross-site); configurable via `COOKIE_SAMESITE`
- `max_age`: 30 days
- `domain`: optional, configurable via `COOKIE_DOMAIN`

**`clear_login_cookie(response)`:** Deletes the auth cookie with matching domain/path/samesite attributes.

### 3.7 Rate Limiting

`backend/app/rate_limit.py`

In-process sliding window implementation:
- `allow(key, scope, max_requests, window_seconds) → bool`
- `(scope, key)` tuple maps to `deque[float]` of timestamps
- Drops expired entries from deque on each call
- Periodic cleanup (~every 10 min) removes entirely stale scope+key entries to prevent unbounded memory growth
- **Limitation:** Process-local only. For multi-instance deployment, migrate to Redis-backed rate limiting.

### 3.8 Permissions

`backend/app/permissions.py`

| Function | Owner? | Shared? | Returns |
|---|---|---|---|
| `can_read(db, user_id, list_id)` | `True` | Any share exists | bool |
| `can_write(db, user_id, list_id)` | `True` | Share with role=editor | bool |

The lists router duplicates this logic inline for tighter route-level integration via `_require_read`/`_require_edit` helpers that raise 404 on denial.

### 3.9 Email Integration

`backend/app/email_resend.py`

- **`ensure_contact(email, name) → bool`:** Upserts email into Resend Audience. Requires `RESEND_AUDIENCE_ID`. Tries Vercel relay function first (keeps API key in Vercel), then direct Resend API. Treats 409 Conflict as success.
- **`sync_all_users(users) → {ok, fail}`:** Batch upserts a list of `(id, email, name)` tuples.

### 3.10 Pydantic Schemas

`backend/app/schemas.py`

**Input validation helpers:**
- `_strip_required_text(value)` → strips whitespace, raises `ValueError` if blank
- `_strip_optional_text(value)` → strips whitespace, returns `None` if blank

**Schema catalog:**

| Schema | Endpoint | Key Fields |
|---|---|---|
| `ListCreate` | POST /lists/ | name (required, 1-100, stripped) |
| `ListRead` | GET response | id, name, owner_id, created_at |
| `ListUpdate` | PATCH /lists/{id} | name (required, stripped) |
| `ListReadEx` | Extended read | extends ListRead: shared, role (owner/viewer/editor), hidden |
| `ItemCreate` | POST items | name, quantity (≥1 ≤9999), expiry, description (≤500), remind_on, purchased |
| `ItemRead` | GET response | All fields incl. list_id |
| `ItemUpdate` | PATCH items | All optional, partial |
| `RegisterRequest` | POST /auth/register | email (EmailStr), password (8-128) |
| `UserRead` | Register response | id, email |
| `TokenResponse` | POST /auth/token | access_token (nullable), token_type |
| `UserProfileRead` | GET/PATCH /me | id, email, name, picture |
| `UserMeUpdate` | PATCH /me | name (≤120), picture (≤2048, sanitized) |
| `ShareCreate` | POST share | email (EmailStr), role (viewer/editor) |
| `ShareRead` | Share response | id, list_id, user_id, email, role |
| `ShareRoleUpdate` | PATCH share role | role (viewer/editor) |

**`UserMeUpdate.picture` sanitization:**
- Rejects strings starting with `<` (XSS prevention)
- Data URLs: only `image/png`, `image/jpeg`, `image/gif`, `image/webp` (no SVG)
- URLs: only `http`/`https` with valid netloc
- All other formats → `None`

### 3.11 SQLAlchemy Models

`backend/app/models.py`

#### ER Diagram

```
User (1) ────< (n) GroceryList ────< (n)  ListItem
  │                    │
  │                    +────< (n) ListShare >──── (1) User (sharee)
  │
  +────< (n) PasswordResetCode
  +────< (n) UsedResetToken
```

#### User (`"user"`)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | Integer | PK | |
| password_hash | String | nullable | Null for Google-only users |
| email | String | unique, index, NOT NULL | Core identity |
| google_sub | String | index, nullable | Google OAuth subject ID |
| name | String | nullable | Display name |
| picture | String | nullable | Profile image URL |

**Relationships:** `lists → GroceryList` (cascade delete-orphan)

#### GroceryList (`"grocery_list"`)

| Column | Type | Constraints |
|---|---|---|
| id | Integer | PK |
| name | String | NOT NULL |
| owner_id | Integer | FK → user.id (CASCADE) |
| created_at | DateTime(tz) | server_default=now() |

**Relationships:** `owner → User`, `items → ListItem` (cascade), `shares → ListShare` (cascade)

#### ListItem (`"list_item"`)

| Column | Type | Constraints |
|---|---|---|
| id | Integer | PK |
| name | String | NOT NULL |
| quantity | Integer | default=1 |
| expiry | Date | nullable |
| description | String | nullable |
| remind_on | Date | nullable — trigger date |
| reminded_at | DateTime(tz) | nullable — last sent |
| purchased | Boolean | server_default=false |
| list_id | Integer | FK → grocery_list.id (CASCADE) |

#### ShareRole Enum

```python
class ShareRole(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"
```

#### ListShare (`"list_share"`)

| Column | Type | Constraints |
|---|---|---|
| id | Integer | PK |
| list_id | Integer | FK → grocery_list.id (CASCADE), indexed |
| user_id | Integer | FK → user.id (CASCADE), indexed |
| role | SAEnum(ShareRole) | server_default="viewer" |
| hidden | Boolean | server_default=false |

**Unique constraint:** `(list_id, user_id)`

#### PasswordResetCode (`"password_reset_code"`)

| Column | Type | Notes |
|---|---|---|
| id | Integer | PK |
| user_id | Integer | FK → user.id (CASCADE), indexed |
| code_hash | String | NOT NULL — Argon2 hash of numeric code |
| created_at | DateTime(tz) | server_default=now() |
| expires_at | DateTime(tz) | NOT NULL |
| used_at | DateTime(tz) | nullable — set when consumed |
| attempts | Integer | server_default=0 — brute-force protection |

**Composite index:** `ix_prc_user_active` on `(user_id, expires_at)`

#### UsedResetToken (`"used_reset_token"`)

| Column | Type | Notes |
|---|---|---|
| id | Integer | PK |
| user_id | Integer | FK → user.id (CASCADE), indexed |
| jti | String | NOT NULL, unique, indexed — JWT ID |
| used_at | DateTime(tz) | server_default=now() |
| expires_at | DateTime(tz) | nullable |

**Purpose:** Single-use enforcement for legacy JWT-based reset tokens.

### 3.12 Routers

#### Lists Router — prefix: `/lists`

`backend/app/routers/lists.py`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | User | Create new list |
| GET | `/?include_hidden=` | User | All lists (owned + shared), de-duped (owned wins), sorted by created_at desc |
| PATCH | `/{list_id}` | Owner | Rename list |
| DELETE | `/{list_id}` | Owner | Delete list (cascade deletes items + shares) |
| POST | `/{list_id}/hide` | Sharee | Hide shared list from view |
| DELETE | `/{list_id}/hide` | Sharee | Unhide shared list |
| POST | `/{list_id}/items` | Write access | Add item to list |
| GET | `/{list_id}/items` | Read access | Get all items in list |
| PATCH | `/items/{item_id}` | Write access | Update item (partial). Resets `reminded_at` if `remind_on` changes. |
| DELETE | `/items/{item_id}` | Write access | Delete item |
| GET | `/{list_id}/share` | Owner | List all shares with user emails |
| POST | `/{list_id}/share` | Owner | Create or update share. Cannot share with self. |
| PATCH | `/{list_id}/share/{share_id}` | Owner | Change share role |
| DELETE | `/{list_id}/share/{share_id}` | Owner | Revoke share |

#### Auth Router — prefix: `/auth`

`backend/app/routers/auth.py`

| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create user with Argon2 hash; upsert into Resend audience (best-effort) |
| POST | `/token` | OAuth2 password flow (username=email). Sets HttpOnly cookie. Returns token in JSON only if `AUTH_HEADER_FALLBACK_ENABLED=1` |
| POST | `/logout` | Clears auth cookie; returns 204 |
| POST | `/change-password` | Requires current pwd if user has one. SSO-only users can set first pwd without current. |
| POST | `/forgot-password` | Rate-limited (IP 5/hr, email 3/hr). Turnstile CAPTCHA. Sends numeric code via email. Always responds "ok" (no user enumeration). |
| POST | `/reset-password` | Code+email flow (preferred) or legacy JWT flow. Single-use enforcement via `used_reset_token` table. |

**Forgot-password email provider chain:**
1. Vercel relay function (`VERCEL_SEND_RESET_URL`) — keeps Resend key in Vercel
2. Resend API directly (if `RESEND_API_KEY` set)
3. SMTP fallback (if `SMTP_HOST/PORT/USER/PASS` configured)
4. No-op if none configured

Renders branded HTML email: SmartGrocery header with blue gradient, code display with dashed border and letter-spacing, action button linking to reset page with pre-filled code+email.

#### Google OAuth Router — prefix: `/auth/google`

`backend/app/routers/auth_google.py`

| Method | Path | Description |
|---|---|---|
| GET | `/login` | Constructs redirect_uri via `_backend_url()`; redirects to Google OAuth consent (openid email profile scopes) |
| GET | `/callback` | Exchanges code via Authlib; extracts userinfo (email, sub, name, picture); finds or creates User; sets JWT cookie; optionally appends token to URL fragment (Safari/ITP); redirects to frontend `/oauth/callback` |

#### Me Router

`backend/app/routers/me.py`

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Returns `UserProfileRead` (id, email, name, picture) |
| PATCH | `/me` | Partial update (`exclude_unset=True`). Stores name/picture as None when blank. |

#### Tasks Router — prefix: `/tasks`

`backend/app/routers/tasks.py`

| Method | Path | Description |
|---|---|---|
| POST | `/run-reminders` | Secured by `x-api-key` or `Authorization: Bearer` matching `CRON_SECRET`. Refuses 503 if secret not configured. Queries items where `remind_on <= today` AND `reminded_at IS NULL` AND `NOT purchased`. Groups by owner; sends HTML digest email (table of list/item/expiry/remind date). Marks all items: `reminded_at = now()`. Returns `{ok, sent}`. |

#### Email Test Router — prefix: `/auth`

`backend/app/routers/email_test.py`

| Method | Path | Description |
|---|---|---|
| POST | `/_test-email` | Secured by `x-api-key` matching `EMAIL_TEST_SECRET` or `CRON_SECRET`. Sends test reset code to specified email. Returns generated code. |
| POST | `/_sync-resend-contacts` | Secured similarly. Batch upserts all users to Resend audience. Returns `{ok, ok: count, fail: count}`. |

### 3.13 Test Suite

`backend/app/tests/`

| File | Tests |
|---|---|
| `conftest.py` | SQLite test DB, `test_user` fixture, `client` fixture with auth override |
| `test_lists.py` | 6 tests: list CRUD, item CRUD, blank name rejection, quantity validation, item deletion |
| `test_permissions.py` | Read/write matrix: owner, viewer, editor, stranger |
| `test_security_hardening.py` | 5 tests: default secret rejection in prod, token not in JSON, CSRF origin rejection, allowed origin, CRON_SECRET required |

**Run:** `cd backend && pip install pytest httpx && pytest app/tests/ -v`

**Architecture:** Tests use SQLite in-memory (`check_same_thread=False`). `_reset_db` fixture (autouse) drops/recreates tables before each test. `client` fixture overrides `get_current_user_any` to return `test_user` without needing actual JWT cookies.

---

## 4. Infrastructure

### Docker Compose (`docker-compose.yml`)

| Service | Base Image | Port | Details |
|---|---|---|---|
| `backend` | python:3.11-slim | 8000 | Runs Alembic → Uvicorn with `--reload`. Volume-mounts `./backend:/app` |
| `frontend` | node:20-slim | 3000 | Runs `npm install && npm start`. Named volume for `node_modules` |

**`start.sh`:** `wait_for_db.py` → `alembic upgrade head` → `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-1}`

> **Note:** Docker Compose does NOT include a local `db` service. The project connects to a hosted PostgreSQL (Supabase) via `DATABASE_URL`.

### Vercel

**`vercel.json` (root):**
- Functions runtime: `nodejs20.x` for `api/**/*.{js,ts}`
- Cron: `0 14 * * *` → calls `/api/cron-run-reminders`
- Build commands skipped (frontend deployed via `frontend/vercel.json`)

**`frontend/vercel.json` (security headers):**
- `Strict-Transport-Security`: max-age=63072000, includeSubDomains, preload
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: strict-origin-when-cross-origin

**Serverless Functions (`api/`):**

| File | Purpose | Auth |
|---|---|---|
| `cron-run-reminders.js` | Vercel Cron → POSTs to backend `/tasks/run-reminders` | `Bearer <CRON_SECRET>` |
| `resend-upsert.js` | Relay contact upsert to Resend (keeps key in Vercel) | `x-api-key` matching `EMAIL_TEST_SECRET` or `CRON_SECRET` |
| `send-reset-code.js` | Relay reset code email sending via Resend API | `x-api-key` matching `EMAIL_TEST_SECRET` or `CRON_SECRET` |

### Cloudflare Pages Functions (`functions/`)

| File | Purpose |
|---|---|
| `_scheduled.js` | Pages Cron backup trigger (scheduled function) |
| `index.js` | Manual test: GET with `Authorization: Bearer <CRON_SECRET>` |

### GitHub Actions (`.github/workflows/reminders.yml`)

- **Trigger:** Daily at 14:00 UTC + manual `workflow_dispatch`
- **Concurrency:** single instance, no overlapping runs (`group: reminders`)
- **Job:** `curl -X POST $API_URL/tasks/run-reminders -H "x-api-key: $CRON_SECRET"`

---

## 5. Data Flow: Request Lifecycle

### Creating a New List (End-to-End)

1. User clicks "Create list" in EnhancedLists.jsx
2. `newListName` state → trimmed → validated non-empty
3. Calls `apiCreateList("Groceries")`
4. **API Client:** POST to `/lists/` with JSON body, `credentials: "include"` (sends cookie)
5. **Middleware:** CORS validates origin → CSRF checks POST+cookie against allowed origins
6. **Router `create_list()`:** `Depends(get_db)` → `Depends(get_current_user_any)` → JWT decode → `db.get(User, int(sub))` → `GroceryList(name, owner_id)` → `db.add/commit/refresh`
7. **Response:** 201 + `{id, name, owner_id, created_at}`
8. EnhancedLists receives result, refreshes full lists from `apiGetLists()`

### Google OAuth Login (End-to-End)

1. User clicks "Continue with Google"
2. Browser redirects to `/auth/google/login`
3. **Backend `google_login()`:** builds redirect_uri → `oauth.google.authorize_redirect()` → 302 to Google
4. Google redirects back to `/auth/google/callback?code=...`
5. **Backend `google_callback()`:** exchanges code → extracts userinfo → finds or creates User → creates JWT → `set_login_cookie()` (HttpOnly cookie) → 302 redirect to frontend `/oauth/callback`
6. **Frontend OAuthCallback.jsx:** checks URL hash for Safari fallback token → stores in localStorage if fallback enabled → calls `refresh()` (GET /me with cookie) → navigates to `/lists`

### Reminder System (End-to-End)

1. Cron trigger (Vercel / Cloudflare / GitHub Actions) calls backend with `x-api-key: <CRON_SECRET>`
2. **Backend `run_reminders()`:** validates secret → queries items where `remind_on <= today` AND `reminded_at IS NULL` AND `NOT purchased`
3. Joins through GroceryList to User (owner), groups by owner
4. Per owner: builds HTML+plain-text email digest → optionally ensures Resend audience membership → sends via Resend API or SMTP
5. Marks all sent items: `reminded_at = now()`
6. Returns `{ok: true, sent: <count>}`

---

## 6. Environment Variables Reference

### Backend Variables

| Variable | Default | Purpose |
|---|---|---|
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin + redirect target |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `SECRET_KEY` | *required (≥32 chars)* | JWT signing key |
| `SESSION_SECRET` | optional when `SECRET_KEY`/JWT alias is set | Starlette session encryption; falls back to the JWT signing secret |
| `REQUIRE_STRONG_SECRETS` | `0` | Enforce prod security in non-prod envs |
| `COOKIE_SECURE` | `0` | Set `Secure` flag on cookies |
| `COOKIE_SAMESITE` | `lax` | SameSite cookie attribute |
| `AUTH_COOKIE_NAME` | `access_token` | Cookie name |
| `AUTH_HEADER_FALLBACK_ENABLED` | `0` | Return JWT in JSON body (for Bearer fallback) |
| `CRON_SECRET` | *required* | Shared secret for cron endpoint auth |
| `RESEND_API_KEY` | *optional* | Resend API key for email |
| `RESEND_AUDIENCE_ID` | *optional* | Resend audience for contact sync |
| `VERCEL_SEND_RESET_URL` | *optional* | Relay URL for reset code email |
| `VERCEL_RESEND_UPSERT_URL` | *optional* | Relay URL for contact upsert |
| `EMAIL_FROM` | `SmartGrocery <no-reply@...>` | Sender address |
| `EMAIL_TEST_SECRET` | *optional* | Auth for test email endpoints |
| `TURNSTILE_SECRET` | *optional* | Cloudflare Turnstile secret key |
| `EXPOSE_RESET_CODE` | *optional* | Include dev code in forgot-password response |
| `GOOGLE_CLIENT_ID` | *required for OAuth* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *required for OAuth* | Google OAuth client secret |
| `BACKEND_URL` | *optional* | Explicit backend URL for OAuth redirects |
| `SMTP_HOST/PORT/USER/PASS` | *optional* | SMTP fallback for email |
| `DB_DISABLE_POOL` | *auto-detected* | Force disable connection pooling |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `1` / `0` | Connection pool tuning |
| `OAUTH_TOKEN_IN_FRAGMENT` | `0` | Include JWT in URL fragment (Safari fallback) |

Koyeb/backend deploys must set one JWT signing secret: prefer `SECRET_KEY`, or reuse an existing `JWT_SECRET_KEY`/`JWT_SECRET`. Use at least 32 random characters. `SESSION_SECRET` can be omitted when one of those JWT signing secrets is set.

### Frontend Variables (`REACT_APP_*`)

| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_API_BASE` | (empty = same origin) | Backend API URL |
| `REACT_APP_AUTH_FALLBACK_STORAGE_KEY` | `token` | localStorage key for Bearer token |
| `REACT_APP_TOKEN_FRAGMENT_PARAM` | `access_token` | URL fragment param name for OAuth token |
| `REACT_APP_AUTH_HEADER_FALLBACK_ENABLED` | `0` | Enable Bearer header fallback |
| `REACT_APP_TURNSTILE_SITE_KEY` | *optional* | Cloudflare Turnstile site key |

---

## 7. Expansion Points & Feature Roadmap

### Backend Expansion

| Feature | Where to Add | What to Change |
|---|---|---|
| **Categories/Tags** | `models.py` → new `Category` table, FK to `ListItem` | New model + migration + filter in `lists.py` |
| **Recipe Integration** | `models.py` → `Recipe` + `RecipeItem` tables | New router at `/recipes`, clone-to-list |
| **Shared List Notifications** | `tasks.py` → new cron endpoint | `Notification` model, email on share/unshare |
| **List Templates** | `models.py` → `ListTemplate` + `TemplateItem` | New router at `/templates` |
| **Bulk Operations** | `lists.py` | Batch add/delete/update with transactional commit |
| **Audit Log** | `models.py` → `AuditLog` table | Middleware/decorator to log CRUD operations |
| **Rate Limit → Redis** | `rate_limit.py` | Replace in-process `deque` with Redis Lua script |
| **WebSocket Live Sync** | `main.py` → WebSocket endpoint | Broadcast list changes to all shared users |
| **Image Upload** | `me.py` pattern → new endpoint | S3/MinIO upload, URL stored in `ListItem` |
| **Nutritional Info** | `ListItem` → add columns | Migration + form fields for calories, protein, etc. |

### Frontend Expansion

| Feature | Where to Add | What to Build |
|---|---|---|
| **Offline Support** | `api.js` → Service Worker + IndexedDB | PWA manifest, sync queue for offline mutations |
| **Push Notifications** | `index.js` → register service worker | Web Push API, backend cron sends push |
| **Drag-and-Drop Sort** | `EnhancedLists.jsx` | react-beautiful-dnd or @dnd-kit |
| **Barcode Scanner** | New component | Camera API / QuaggaJS → populate item |
| **Meal Planner** | New page `/meal-planner` | Calendar view, drag items to days, generate list |
| **Price Tracking** | `ListItem` + `api.js` | Add price field, total-per-list |
| **Export/Import** | `EnhancedLists.jsx` toolbar | CSV/JSON export, clipboard import |
| **E2E Testing** | `frontend/cypress/` | Cypress or Playwright for critical journeys |
| **i18n** | All text strings | react-intl or react-i18next |

### Infrastructure Expansion

| Need | Solution |
|---|---|
| Horizontal scaling | Redis rate limiter, PgBouncer for DB pooling |
| CDN for images | S3 + CloudFront for user-uploaded images |
| Monitoring | Sentry (errors), Prometheus + Grafana (metrics) |
| CI/CD | GitHub Actions: lint → test → build → deploy |
| Database backups | pg_dump cron to S3 |
| Staging environment | Separate Koyeb app + Supabase branch |

### Reusable Patterns to Follow

1. **Dependency Injection** (`deps.py`): Add `Depends(get_redis)`, `Depends(get_storage_client)` following the same pattern.
2. **Schema Validators** (`schemas.py`): Follow `_strip_required_text` / `_strip_optional_text` patterns for new fields.
3. **Router Pattern** (`routers/*.py`): `APIRouter(prefix="...", tags=[...])`, mounted in `main.py` via `app.include_router()`.
4. **Model Relationships** (`models.py`): Use `cascade="all, delete-orphan"` and `passive_deletes=True` for parent-child data integrity.
5. **API Client Pattern** (`api.js`): New API functions wrap `request(path, options)` for consistent error handling.
6. **Code Splitting** (`App.js`): New pages use `React.lazy()` for route-level code splitting.
7. **Auth Guard Pattern** (`App.js`): `RequireAuth` wraps protected routes with loading/null states.

### Database Migration Pattern

```bash
cd backend
alembic revision -m "description_of_change"
# Edit the generated migration file in alembic/versions/
alembic upgrade head
```

Each migration auto-applies in `start.sh` before the server starts. Production deployment runs migrations as part of the startup command.

---

> **SmartGrocery-Lite** — Technical Documentation v1.0 — Generated May 2026
