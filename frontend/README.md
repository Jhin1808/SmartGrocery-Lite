# SmartGrocery Lite – Frontend

Modern React 19 UI powered by Vite. This folder only contains the PWA shell (lists, pantry automation, authentication UI). APIs and background jobs are handled by the backend workspace.

## Prerequisites

- **Node.js ≥ 20.19.0** (aligns with Vite 6 minimums)
- **npm ≥ 10**
- Copy `.env.example` to `.env.local` (or reuse `.env.development.local`) and fill in the values that make sense for your environment.

```bash
cd frontend
cp .env.example .env.local  # or set the vars in Vercel/Netlify/Supabase dashboards
npm install
```

## Runtime configuration (Vite)

| key                         | purpose                                                                                       |
|-----------------------------|------------------------------------------------------------------------------------------------|
| `VITE_API_BASE`             | Optional absolute base URL for API calls. Leave empty to talk to the same origin.             |
| `VITE_TURNSTILE_SITE_KEY`   | Cloudflare Turnstile site key used on the reset-password page.                                |
| `VITE_AUTH_FALLBACK_STORAGE_KEY` | LocalStorage key for Safari’s cookie fallback (defaults to `token`).                         |
| `VITE_TOKEN_FRAGMENT_PARAM` | Query parameter to read tokens from OAuth fragments (defaults to `access_token`).             |

> The older `REACT_APP_*` keys are still recognised but will be removed after all deployments are migrated.

## Available scripts

| command            | description                                               |
|--------------------|-----------------------------------------------------------|
| `npm run dev`      | Start Vite in dev mode (defaults to http://127.0.0.1:5173) |
| `npm run test`     | Run Vitest once (uses jsdom + Testing Library)            |
| `npm run test:watch` | Watch-mode tests                                         |
| `npm run build`    | Production build written to `dist/`                       |
| `npm run preview`  | Serve the built bundle locally                            |

## Deployment cheatsheet

1. Set the working directory to `frontend/`.
2. Install & build: `npm install && npm run build`.
3. Serve the `frontend/dist` folder (Vercel/Netlify static hosting, GitHub Pages, Cloudflare Pages, etc.).
4. Configure the following environment variables in your hosting dashboard: `VITE_API_BASE`, `VITE_TURNSTILE_SITE_KEY`, `VITE_AUTH_FALLBACK_STORAGE_KEY`, `VITE_TOKEN_FRAGMENT_PARAM`.

Examples:

- **Vercel** – `installCommand: "cd frontend && npm install"`, `buildCommand: "cd frontend && npm run build"`, `outputDirectory: "frontend/dist"`. Keep `/api` serverless functions alongside the static output.
- **Supabase/Koyeb backend + Netlify/Vercel frontend** – Deploy this folder as a static site, point `VITE_API_BASE` to the hosted API (e.g., `https://koyeb-instance.koyeb.app`).
- **GitHub Pages** – Use the provided GitHub Actions workflow or GitHub Pages build job to run `npm run build` and push `frontend/dist` to the `gh-pages` branch.

## Continuous integration

`.github/workflows/frontend.yml` runs `npm run test` and `npm run build` on every push/PR that touches the frontend. Keep this green before deploying.
