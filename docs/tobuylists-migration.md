# ToBuyLists domain migration

## Confirmed production issue

On September 11, 2026, `https://www.tobuylists.com/` served
`/static/js/main.284fdb26.js`. That bundle contains
`REACT_APP_API_BASE: "https://api.smartgrocery.online"`.
The Google button therefore still navigates to the old API domain.
Changing `homepage`, canonical tags, or frontend DNS does not change a compiled
React environment variable. The frontend must be rebuilt after its API setting changes.

Requests to both API hostnames could not be verified from the development
environment. Do not treat that as proof of a DNS outage. Confirm the new API
host and certificate before switching the production frontend.

## Production configuration

Use `www.tobuylists.com` as the frontend's canonical hostname, consistent with
the repository's existing canonical tags. The recommended API hostname is
`api.tobuylists.com`, so the frontend and API are on the same site and do not
depend on third-party cookies.

| Location | Setting | Value |
| --- | --- | --- |
| Frontend Vercel project, Production environment | `REACT_APP_API_BASE` | `https://api.tobuylists.com` |
| Backend hosting environment | `FRONTEND_URL` | `https://www.tobuylists.com` |
| Backend hosting environment | `FRONTEND_ORIGINS` | `https://tobuylists.com` |
| Backend hosting environment | `BACKEND_URL` | `https://api.tobuylists.com` |
| Backend hosting environment | `GOOGLE_REDIRECT_URI` | `https://api.tobuylists.com/auth/google/callback` |
| Backend hosting environment | `COOKIE_SECURE` | `1` |
| Backend hosting environment | `COOKIE_SAMESITE` | `lax` |
| Backend hosting environment | `COOKIE_DOMAIN` | Remove this variable so cookies are scoped to the API host |
| Backend hosting environment | `AUTH_HEADER_FALLBACK_ENABLED` | `0` |
| Backend hosting environment | `OAUTH_TOKEN_IN_FRAGMENT` | `0` |
| Frontend environment | `REACT_APP_AUTH_HEADER_FALLBACK_ENABLED` | `0` |

Keep the existing Google client ID and secret. Keep stable, secret values of
at least 32 characters for `SECRET_KEY` and `SESSION_SECRET` in the backend
hosting environment. Changing a session secret during OAuth loses the saved
OAuth state. Do not commit secrets or put them in `REACT_APP_*` variables.

The first `FRONTEND_URL` entry remains the redirect destination if a legacy
comma-separated value is used. All entries still become allowed CORS/CSRF
origins. Prefer the separate `FRONTEND_ORIGINS` setting for clarity.

## Apply in this order

1. Add `api.tobuylists.com` as a custom domain on the existing backend service.
   Use the DNS target and verification records supplied by that service in
   Cloudflare. Do not point the API hostname at the React frontend.
   Wait for the backend's certificate and domain verification to finish.
2. Update the backend environment using the table and redeploy the backend.
   Preserve the existing database and secrets.
3. In the existing Google OAuth **Web application** client, add this exact
   **Authorized redirect URI**:
   `https://api.tobuylists.com/auth/google/callback`.
   Google's callback goes to FastAPI, not `/oauth/callback` on the frontend.
   Update the consent screen's application links and authorized domain to
   `tobuylists.com` as applicable. JavaScript origins are not used by this
   server-side flow; adding them alone does not fix a redirect mismatch.
4. Update `REACT_APP_API_BASE` in the frontend Vercel project's **Production**
   environment, then build and deploy the reviewed branch. Its project root
   should be `frontend`, build command `npm run build`, output directory
   `build`. The root `vercel.json` belongs to the separate reminder functions.
   If a Preview deployment is used, configure an exact preview frontend origin
   on a test backend and use a matching OAuth setup.
5. Open `https://www.tobuylists.com/login`, sign in with Google, and confirm
   `/me` succeeds and adding/checking off an item persists after reload.
   The first sign-in after moving domains creates a new cookie on the new host.
6. Check a small mobile viewport and a desktop viewport, including switching
   lists, long item names, editing quantity/expiry, sharing, shop mode, and
   bottom navigation. Verify direct reloads of `/lists/<id>` and
   `/oauth/callback` reach the React app.

If temporarily using the backend's unrelated provider hostname, use that
same hostname in `REACT_APP_API_BASE`, `BACKEND_URL`, and Google's callback.
Cross-site cookies then require `COOKIE_SAMESITE=none` and `COOKIE_SECURE=1`,
and browsers may still block them. The same-site API subdomain is preferred.

## Error interpretation

| Symptom | Check |
| --- | --- |
| Browser visits `api.smartgrocery.online` | Old frontend build or Vercel environment value |
| Google `redirect_uri_mismatch` | Exact callback URI on the existing OAuth client |
| Return to old frontend domain | Backend `FRONTEND_URL`, then redeploy |
| Google login unavailable | Backend Google credentials, configured callback, or upstream connection |
| OAuth callback fails after redirect | Stable session secret; login and callback must use the same API host |
| Sign-in succeeds but session is missing | `/me` request, API base, cookie host/SameSite/Secure, CORS |
| Cookie-authenticated mutation returns 403 | Exact frontend origin in `FRONTEND_URL` or `FRONTEND_ORIGINS` |

No Google credentials, DNS, or production hosting variables are changed by
merging these source changes alone.

## Design references

The workspace adapts familiar navigation and list patterns rather than using
another application's code, branding, or assets:

- [AnyList lists](https://www.anylist.com/features): category filters and grocery metadata.
- [Todoist](https://www.todoist.com/features): a compact list rail and clear primary list surface.
- [Google web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server): callback configuration and redirect URI matching.
