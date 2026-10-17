# Gemini investigation ? 2026-10-16

## Outcome and exact cause

Real Gemini requests reproduced HTTP 503 with provider status UNAVAILABLE and a message indicating temporary high model demand. This was a provider capacity failure, not query-specific request formatting. The original service had no retry loop and discarded the provider error message. Health configured=true only checks whether a key exists; it does not test model access, quota, billing, or availability.

The running service and python-service/.env actually selected gemini-flash-latest. Explicitly testing the reported gemini-2.5-flash returned HTTP 404 NOT_FOUND for all five requests: the provider said that model is no longer available to new users. The original gemini-flash-latest setting was restored; no API key value was changed. The provider's later quota message identifies the alias target as gemini-3.8-flash.

After successful calls, Gemini returned HTTP 429 RESOURCE_EXHAUSTED for generate_content_free_tier_requests, limit 20, with approximately 18 hours until retry. Further provider calls were stopped. This is a quota restriction requiring quota reset or review of the provider project/plan/billing, rather than another parsing fix.

## Pipeline

VoiceAssistant.jsx -> queryAssistant -> Express /api/assistant/query -> MongoDB exact lookup -> FastAPI /api/process only if dictionary lookup is insufficient -> Gemini generateContent -> validated Pydantic JSON -> Express data envelope -> Voice AI translation/explanation/detected slang card.

Express /api/ai/process is an explicit AI proxy; callers wanting dictionary-first behavior should use /api/assistant/query. FastAPI has no MongoDB connection and remains the internal AI-only service.

## Files changed

- python-service/app/services/gemini.py: sanitized provider status/message logging, separate error codes, bounded retries, Retry-After and RetryInfo parsing, response-shape and finish-reason validation.
- python-service/app/routes/processing.py: return Retry-After on controlled provider errors.
- python-service/tests/test_gemini.py: recovery, permanent-error no-retry, retry exhaustion, sanitization, malformed responses, quota, and Retry-After regression coverage.
- backend/utils/assistantQuery.js: normalize curly apostrophes and narrowly alias standalone cooked expressions.
- backend/controllers/assistantController.js: exact phrase first, then cooked alias; preserve Retry-After.
- backend/controllers/aiController.js: preserve recognized provider error codes on the AI processing proxy and forward Retry-After; classify internal request timeout as 504.
- backend/utils/aiErrors.js: distinguish high demand from quota/billing guidance.
- backend/tests/api.test.js: dictionary-first cooked/no cap/rizz coverage with no provider fetch.
- backend/tests/aiProxy.test.js: safe quota code and Retry-After forwarding.
- frontend/src/services/aiService.js: explicit AI processing timeout 45 seconds, matching the existing assistant timeout.
- frontend/src/utils/assistantError.js: explicit Gemini high-demand message.
- frontend/pages/VoiceAssistant.test.jsx: render the exact successful live Gemini cooked response.
- GEMINI_INVESTIGATION.md: this report.

The Gemini request format and structured JSON schema succeeded in real requests, so no speculative request-format replacement was made. Parsing now rejects truncated/blocked or malformed output with AI_INVALID_RESPONSE rather than accepting partial data or crashing. No frontend layout redesign or dictionary data writes were performed.

## Retry behavior

At most three attempts total. Backoff is 0.5 seconds, then 1 second, each with up to 0.25 seconds of jitter. Respect longer Retry-After (seconds or HTTP date) and google.rpc.RetryInfo delays. Entire provider operation has a 28-second deadline; delays that cannot fit cause an immediate controlled error with Retry-After rather than an early retry. Individual HTTP timeout remains 20 seconds; Express has a 35-second timeout and AI frontend calls have 45 seconds.

Retry transient 408/500/502/503/504, transport failures, timeouts, and temporary 429 when the provider's delay fits. Never retry 400 invalid requests, invalid-key 400, 401/403, model 404, parsing errors, or recognized daily/zero-allocation/billing-disabled quota failures. Long quota retry delays do not fit the request budget and are returned immediately. Provider HTTP statuses and sanitized diagnostics stay in server logs; clients receive safe stable error codes.

## Verification

- Python: 51 tests passed. Non-failing dependency deprecation warnings and an existing pytest-cache permission warning remain.
- Backend: 85 tests passed, using temporary MongoDB plus mocked upstream failures.
- Voice AI: 25 component tests passed, including the exact live successful response, contextual rendering, dictionary rendering, and existing speech controls.
- Frontend production build passed.
- Real consecutive updated-FastAPI requests, through its ASGI route and the real external Gemini API: reason -> 200; I am cooked -> 200; left on read -> 503 then 200 on attempt 2; contextual rizz/cooked -> 503 then 429; repeated reason -> 429. Three of five requests succeeded; two were quota-blocked.
- Live Express + development MongoDB: I'm cooked -> 200 dictionary Cooked; What does I am cooked mean? -> 200 dictionary Cooked; no cap -> 200 dictionary No Cap; rizz -> 200 dictionary Rizz.
- Real direct pre-fix diagnostic requests: three consecutive Gemini 503 UNAVAILABLE responses. Separate initial FastAPI requests returned 200 for both reported example questions, confirming intermittency.

## Remaining limitations

Code cannot remove provider capacity or quota limits. Model 2.5 Flash was unavailable to this key; the original latest alias remains configured. Once quota resets or billing/quota is resolved, repeat a contextual request through the full browser -> Express -> FastAPI path. Updated FastAPI real AI success and frontend rendering of the captured real payload were verified separately; a final fresh full-chain AI success was prevented by quota. Physical microphone recognition, audible output, and browser permission dialogs were not manually verified. Restart services if they are not running with source reload.
