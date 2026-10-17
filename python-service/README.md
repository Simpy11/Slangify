# Slangify Python service

FastAPI provides contextual slang translation through Google's Gemini generateContent API. Express remains the public API and MongoDB owner; browser clients must call Express, not this service or Gemini directly.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set your private `GEMINI_API_KEY` in `.env`. The example uses `GEMINI_MODEL=gemini-flash-latest`; you can change it to another model supported by your Gemini account. No key is required for `/health`.

```powershell
uvicorn app.main:app --reload --port 8001
```

On macOS/Linux, activate with `source .venv/bin/activate` and use `cp .env.example .env`.

## Endpoints

- `GET /health` — service health
- `POST /api/process` — validates up to 2,000 characters and returns `source`, `original`, `translation`, `explanation`, and `detectedSlang`

One query makes at most one Gemini request. The provider call has a configurable 45-second total timeout (`GEMINI_TIMEOUT_SECONDS`), schema-constrained JSON output, and server-side Pydantic validation. Missing/invalid keys, provider failures, and malformed output produce safe errors without exposing credentials.

## Tests

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest
```

Provider behavior is mocked in tests; actual Gemini output requires a private key and a live manual check. FastAPI has no browser CORS middleware because Express calls it server-to-server.


The `.env` file is resolved from this service directory regardless of launch directory.
From the repository root on Windows, use the installed virtual environment:

```powershell
.\python-service\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir python-service --host 127.0.0.1 --port 8001
```

`/health` reports service liveness and `provider.configured`; it does not call Gemini or prove provider access.
After changing `.env`, restart Python. Express waits up to 55 seconds (`PYTHON_SERVICE_TIMEOUT_MS=55000`) and the browser up to 60 seconds (`VITE_AI_TIMEOUT_MS=60000`). Keep the browser deadline longer than Express, and Express longer than Gemini when overriding these values. Gemini connection establishment is capped at 5 seconds. There are no automatic provider retries: quota and overload responses return immediately with their safe codes and Retry-After, avoiding duplicate calls or a retry masking the original error.
Errors include safe codes for missing keys, authentication, quota (429), missing models, timeouts (504),
network failures, and malformed answers. Logs contain only these codes/statuses, never provider response bodies.
English, Hindi, and Hinglish text uses the same endpoint; browser speech recognition availability and language support depend on the browser.
