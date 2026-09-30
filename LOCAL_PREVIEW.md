# Local market preview

The current checkout is the GitHub-based `design/hallmark-live` branch. Use two terminals from this repository. The frontend is at http://localhost:3000; the authenticated fridge is at /fridge.

Backend (PowerShell, from backend):

```powershell
$env:DATABASE_URL = "sqlite:///./.hallmark-preview-live.db"
$env:FRONTEND_URL = "http://localhost:3000"
$env:COOKIE_SECURE = "false"
$env:COOKIE_SAMESITE = "lax"
$env:SECRET_KEY = "local-preview-secret-at-least-32-characters"
$env:SESSION_SECRET = "local-preview-session-at-least-32-characters"
../.venv/Scripts/python.exe -c "from app.models import Base; from app.database import engine; Base.metadata.create_all(engine)"
../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (PowerShell, from frontend):

```powershell
$env:REACT_APP_API_BASE = "http://localhost:8000"
$env:BROWSER = "none"
npm start
```

Create or sign in to a local account. Google OAuth needs provider configuration. Demo mode uses sample data and cannot authenticate to Kroger; fridge inventory requires an account.

TheMealDB recipes and Open Food Facts barcode lookups work without private API keys. Kroger requires backend `KROGER_CLIENT_ID` and `KROGER_CLIENT_SECRET`, or an authenticated production test session. Local and production accounts are separate.

For production, apply the Alembic migration instead of `create_all`. This task does not merge or deploy the branch.
