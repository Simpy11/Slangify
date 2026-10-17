# Environment setup

Slangify keeps runtime configuration outside the source code. Never commit real `.env` files or put secrets in variables prefixed with `VITE_`; Vite exposes those values in the browser bundle.

For local development:

1. Copy `frontend/.env.example` to `frontend/.env`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Copy `python-service/.env.example` to `python-service/.env` to enable Gemini fallback; set `GEMINI_API_KEY` privately. `GEMINI_MODEL` is optional.
4. Replace the backend MongoDB and JWT placeholders with private local values.
5. Set `PYTHON_SERVICE_URL` to the internal FastAPI base URL (locally, `http://127.0.0.1:8001`).
6. Keep `/api` at the end of `VITE_API_URL`, because frontend service paths begin with `/auth`, `/slang`, `/favorites`, `/ai`, and `/assistant`.

Production hosting should provide the same variables through its environment settings. `VITE_API_URL` is resolved when the frontend is built, while backend variables are read when the server starts.
