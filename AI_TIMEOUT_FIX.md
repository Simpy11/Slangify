# AI timeout fix ? 2026-10-17

## Findings and request flow

React VoiceAssistant -> aiService Axios -> Express /api/assistant/query -> dictionary lookup -> FastAPI /api/process -> Gemini generateContent via HTTPX (no Gemini SDK).

The original Python implementation used a hardcoded 20-second HTTP timeout and 28-second overall retry deadline. Express allowed 35 seconds and React AI calls allowed 45 seconds (overriding Axios's shared 25-second default). Python could therefore return AI_TIMEOUT while the outer layers still had time available. The component AbortController cancels navigation/unmount; it does not create a response deadline.

Automatic retries could turn an initial Gemini 429 into a later timeout, masking quota exhaustion and making multiple provider calls for one click. Separately, Express could misclassify an aborted response-body read as invalid JSON, and the explicit AI proxy collapsed timeout failures to HTTP 503.

These are confirmed code defects, not proof of which event caused the user's historical request. The reported timeout was not reproduced during this investigation. Before changes, a live full-chain Express -> FastAPI -> Gemini request returned HTTP 200/source=ai in 5.75 seconds. The existing investigation describes prior Gemini overload/quota failures, but those were not observed in this run.

## Fix

- One Gemini call per submitted request; no automatic retries on quota, overload, network errors, or timeout. Retry-After remains available to callers.
- Configurable overall Gemini deadline: GEMINI_TIMEOUT_SECONDS=45; HTTPX connection deadline at most 5 seconds.
- Express deadline: PYTHON_SERVICE_TIMEOUT_MS=55000, covering headers and response body.
- React AI deadline: VITE_AI_TIMEOUT_MS=60000. Shared non-AI Axios settings remain unchanged.
- When overriding these settings, preserve Gemini < Express < React; allow extra browser time for dictionary lookup.
- Preserve safe quota 429, provider unavailable 503, timeout 504, and authentication configuration errors. HTTP status fallback works even without a JSON error code. Quota status takes precedence over generic client timeout codes.
- Diagnostics report layer, elapsed duration, status, and safe error codes without logging prompts, response bodies, URLs, or keys.
- Existing synchronous submission guard, dictionary-first behavior, microphone input, Listen controls, and UI remain unchanged.

## Local configuration verified

backend/.env selects PYTHON_SERVICE_URL=http://127.0.0.1:8001. Both direct Python health and Express-proxied health returned HTTP 200. Python resolved its service-local .env and loaded a populated GEMINI_API_KEY. The key was neither printed nor modified. No private .env file was changed.

## Modified files

- backend/app.js ? configurable validated Python-service timeout.
- backend/controllers/aiController.js ? timeout/body-read handling, safe layer diagnostics, error forwarding.
- backend/controllers/assistantController.js ? upstream HTTP-status fallback.
- backend/utils/aiErrors.js ? allowlisted error-code/status resolver.
- backend/tests/aiProxy.test.js ? timeout, stalled body, offline Python, and non-JSON upstream errors.
- backend/.env.example ? documented public timeout setting only.
- python-service/app/config.py ? configurable validated Gemini deadline.
- python-service/app/services/gemini.py ? one provider call, overall deadline, safe diagnostic logging.
- python-service/app/main.py ? FastAPI duration/status diagnostics.
- python-service/tests/test_config.py ? timeout configuration tests.
- python-service/tests/test_gemini.py ? slow success, real async deadline, quota preservation, single-call failures.
- python-service/.env.example ? timeout setting only; existing example key unchanged.
- python-service/README.md ? current timeout hierarchy and single-call behavior.
- frontend/src/services/aiService.js ? configurable AI-specific timeout and safe failure diagnostics.
- frontend/src/services/aiService.test.js ? updated timeout expectations.
- frontend/src/utils/assistantError.js ? quota precedence and ETIMEDOUT classification.
- frontend/src/utils/assistantError.test.js ? quota/timeout precedence tests.
- frontend/.env.example ? public browser timeout setting.
- AI_TIMEOUT_FIX.md ? findings and verification report.

## Verification

- Python: 59 tests passed; two existing dependency deprecation warnings.
- Backend proxy and API integration: 89 tests passed, including dictionary-first/no-provider behavior and unavailable Python service.
- Frontend AI service, error mapping, VoiceAssistant, speech hooks, and response formatting: 46 tests passed, including duplicate submission prevention and per-message Listen playback.
- Frontend ESLint and Vite production build passed.
- Updated FastAPI code with real Gemini: HTTP 200, valid translation, Gemini duration 8.766 seconds (8.844 seconds including the ASGI client).
- Slow, quota, invalid-key, unavailable-provider, and network failures use controlled mocks; no deliberate live quota exhaustion or service shutdown was performed.

Restart Express and FastAPI if they are running without source reload. Provider capacity and quota restrictions still require recovery at Gemini; those conditions now retain their own error messages instead of being hidden by retries.
