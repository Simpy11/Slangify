# Slangify testing

## Install and run

Install dependencies separately in `backend` and `frontend` with `npm install`.

Python service tests use pytest and FastAPI's test client:

```powershell
cd python-service
python -m pip install -r requirements-dev.txt
python -m pytest
```

Backend API tests use Supertest, Vitest, and `mongodb-memory-server`:

```powershell
cd backend
npm test
```

The backend tests start a temporary in-memory MongoDB instance. They never read `MONGO_URI` and never connect to the development or production database. The first run may download a MongoDB test binary and therefore may require network access.

Frontend behavior tests use Vitest, jsdom, and React Testing Library:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

Use `npm run test:watch` in either folder while developing.

The Express tests cover MongoDB-first routing, contextual fallback, validation, downtime, and upstream failures. Python tests mock Gemini requests, including missing key, malformed output, rate limits, and timeout. For a live check with your private key, start FastAPI and Express, request `GET /api/ai/health`, then send `POST /api/assistant/query` with `{ "text": "Bro really left me on read" }`. Stop FastAPI: a known slang query should still return `source: dictionary`, while contextual input should return a safe `503`.

## Manual end-to-end check

Use a dedicated local/test database, never production data.

1. Register User A with a password of at least eight characters and log in.
2. Add a unique slang entry, find it in Explore, favorite it, and confirm it appears on Favorites.
3. Log out and back in as User A; confirm the favorite persists.
4. In Voice Assistant, type a question for the new slang and confirm the database meaning appears.
5. Remove the favorite and log out.
6. Register/login as User B and verify User B cannot update or delete User A's slang through the API (403).

## Manual Voice Assistant check

Use a current Chromium-based browser over localhost or HTTPS.

- Allow microphone access, click the microphone, and say “What does rizz mean?” Confirm listening state, transcript, and database result.
- With a matching dictionary entry, confirm the voice result speaks automatically and remains available even when FastAPI is stopped.
- With a private Gemini key configured, say “Bro really left me on read” and “Bro has no rizz and got cooked”; confirm contextual AI translation, detected slang, and automatic speech. Type the same text and confirm it uses the same assistant API but does not speak automatically.
- Repeat with “rizz”, “What is rizz?”, “Explain rizz”, and an unknown term.
- Click Listen and confirm the returned meaning is spoken. Start another result and confirm speech does not overlap; use Stop to cancel.
- Deny microphone permission and confirm a friendly message appears while typed search still works.
- Test a browser without SpeechRecognition support and confirm the microphone is disabled while typed search remains usable.

Physical microphone recognition, audible output, and browser permission dialogs cannot be validated by jsdom tests.

## Browser pointer interaction regression

With Vite running on `http://127.0.0.1:5173`, run this from the repository root on Windows with Google Chrome installed:

```powershell
node readiness-artifacts/check-interactions.cjs
```

For a read-only check against the running backend, use `node readiness-artifacts/check-interactions.cjs --live-smoke`. This opens `http://localhost:5173` to match the development backend's allowed origin, verifies the homepage link and live search, and accepts a genuine empty dictionary response. It writes `readiness-artifacts/interactions-live.json`.

This dependency-free check uses Chrome DevTools hit testing and real mouse/key events. It exercises navigation, live search, filters, favorites, Add Slang, authentication, theme switching, and Voice AI, then checks all seven routes at 375, 390, 768, and 1440 pixels in both themes. It saves `readiness-artifacts/interactions-after.json` and exits unsuccessfully for a covered control or failed behavior assertion.

API responses and browser speech are fixtures. The check never writes to MongoDB or calls the AI provider, and does not verify actual microphone recognition or sound. Its isolated headless Chrome profile is stored in `readiness-artifacts/chrome-interactions`. Chrome's sandbox is disabled for this local-only run because the restricted execution environment prevents its GPU subprocess from starting. The script opens only the local Vite app; do not use that Chrome profile for ordinary browsing. Browser errors include source labels to distinguish external font-loading failures from React runtime exceptions.

### Voice integration regression coverage

Both recognized speech and typed input use `processAssistantQuery` in `VoiceAssistant.jsx`, which calls Express `POST /api/assistant/query`. Dictionary cards use the returned word, meaning, example, category, and emoji; AI cards use translation, explanation, and detected slang. Voice submissions automatically speak the useful answer; typed submissions offer Listen without automatic speech. The existing homepage microphone still navigates to Explore.

Frontend tests cover Enter submission, dictionary/AI rendering, automatic voice speech, manual Listen/Stop, denied microphone permission with typed fallback, unsupported recognition, empty/duplicate submissions, invalid responses, request abortion on unmount, late recognition events, and cancelled utterance events. Backend tests exercise real temporary MongoDB queries and mocked AI downtime, including dictionary success while AI is unavailable. Python tests mock the provider; these tests do not verify live provider availability.

Also manually check rapid Start/Stop clicks, typing while recognition is active, starting the microphone during speech, and navigating away during processing. Ensure no delayed transcript creates an extra request and no cancelled response starts speaking. Check Listen for both dictionary and AI cards, backend downtime, and independent browser TTS support.

## Manual responsive check

In browser developer tools, check 375×667, 390×844, 768×1024, and 1440×900. Inspect the navbar, homepage hero/search/cards/A–Z controls, Explore filters and pagination, Favorites, Add Slang, Voice Assistant, login/signup, and footer.

At each size verify there is no horizontal overflow, clipped text, overlap, broken grid, inaccessible form field, or button with an unusably small hit area. Also open/close the mobile navigation and exercise loading, empty, API-error, validation-error, and logged-out protected-action states.

## Explore search regression

Frontend tests cover the 300ms debounce, page reset, filters, cancellation (including responses arriving during debounce), and genuine empty versus API error states. Service tests verify `/api/slang` and the `search` parameter. Backend tests use real temporary MongoDB queries for single letters, substrings, full words, mixed case, phrases, literal regex characters, and matches beyond the first twelve documents.

On October 22, 2026, read-only production checks against the API configured in the public Vercel bundle returned 620 matches for `a`, 189 for `b`, 317 for `s`, 34 for `ri`, 6 for both `Delulu` and `dELuLu`, and 3 for `No Cap`. The reported single-letter failure was not reproduced in the API or baseline local tests. Direct `/explore` requests did return Vercel 404; the frontend Vercel rewrite fixes that routing issue after redeployment. These observations do not establish the cause of an intermittent browser search failure.

After deployment, open `/explore` directly and refresh it. Search from page 2 and verify the request uses `page=1`; combine category and Trending Only with each sort mode. Inspect the network request to confirm `search=a` reaches the configured production backend. A category, initial-letter filter, and Trending Only intentionally narrow the search together.
