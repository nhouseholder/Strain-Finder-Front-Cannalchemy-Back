# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

Cannalchemy is a two-service app: a Python FastAPI backend (port 8000) and a React/Vite frontend (port 5173). The Vite dev server proxies `/api/v1` and `/api/health` to the backend. The SQLite database at `data/processed/cannalchemy.db` is pre-seeded and committed to the repo — no migrations or bootstrapping needed.

### Running services

- **Backend:** `uvicorn backend.app.main:app --reload --port 8000` (from repo root)
- **Frontend:** `npm run dev` (from `frontend/`)
- Verify backend health: `curl http://localhost:8000/api/health`
- The frontend opens at `http://localhost:5173`

### Lint / Test / Build

- **Python tests:** `pytest` (from repo root). 1 pre-existing failure in `test_pubchem.py` (type comparison issue).
- **Frontend lint:** `npm run lint` (from `frontend/`). Pre-existing lint errors exist.
- **Frontend build:** `npm run build` (from `frontend/`)

### Gotchas

- `pip install -e ".[api,dev]"` installs to `~/.local/bin` (uvicorn, pytest, etc.). Ensure `$HOME/.local/bin` is on `PATH`.
- External services (Firebase, Stripe, Supabase, Anthropic) are all optional. The core quiz/recommendation flow works without any env vars or API keys.
- The `setup.sh` script is for production SaaS deployment (Supabase + Stripe + Netlify) — it is interactive and not needed for local dev.
