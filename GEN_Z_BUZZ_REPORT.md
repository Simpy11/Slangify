# Standalone Gen Z Buzz delivery report

Verified on 2026-10-16 with React on port 5173 and Express on port 5000.

## Result

Gen Z Buzz is a standalone page at `/genz-buzz`. Every main navbar has a separate gradient **Gen Z Buzz** navigation button immediately between **Explore** and **Favorites**. The page has an active button state with `aria-current=page`; mobile/tablet menus collapse before labels collide and close after selection. Home and Explore do not embed the news feed. Existing pages and their routes remain available.

The page displays five eligible unique news articles when available, with real publisher images (or an honest unavailable-image state), headline, feed summary, publisher attribution, original publication date/time and Read More links opening original articles in a new tab. Refresh News uses the same cached backend endpoint. Skeleton, empty, error/retry, stale-cache and partial-source states are supported, with dark/light gradients, responsive cards, and reduced-motion support.

## Sources, selection and cache

Express continues to use GET `/api/news` with the existing public publisher feeds:

- The Verge: https://www.theverge.com/rss/index.xml
- BBC Technology: https://feeds.bbci.co.uk/news/technology/rss.xml
- BBC Entertainment: https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml
- The Guardian Games: https://www.theguardian.com/games/rss
- The Guardian Music: https://www.theguardian.com/music/rss
- The Guardian Lifestyle: https://www.theguardian.com/lifeandstyle/rss

Publisher feed fields supply all headlines, images, summaries, and dates. There are no Gemini requests or fabricated news. Existing topic/keyword relevance filtering covers internet/social trends, memes, entertainment/music, games, technology/AI, fashion and youth culture. Eligible articles are now sorted primarily by newest publication timestamp; relevance breaks timestamp ties. Canonical URLs and normalized headlines are deduplicated, articles older than 72 hours are excluded, publication timestamps are required, and future dates beyond five minutes of clock skew are rejected. Atom update timestamps do not substitute for missing publication dates.

The shared backend cache defaults to 45 minutes, clamped to 30–60 by the existing NEWS_CACHE_MINUTES setting. Concurrent refreshes share one in-flight fetch, and query parameters cannot force a cache bypass. The open page checks every 45 minutes; the first request after backend expiry fetches feeds again. Feed timeouts, partial outages, five-minute failure cooldowns and recent stale fallback behavior remain intact.

## Setup

No additional dependencies, API keys, accounts or environment variables were needed for this standalone-page change. Existing RSS dependencies remain in backend/package.json and its lockfile. Fresh checkouts should run npm install in backend and frontend, then use the existing application startup commands.

Optional existing backend/.env configuration:

```env
NEWS_CACHE_MINUTES=45
```

backend/.env.example already documents that setting and that no news API key is needed, so it required no further changes. No .env secrets were changed or exposed to React. README now documents the dedicated route, navigation, newest-first selection and production SPA fallback requirement: static hosts must serve index.html for `/genz-buzz`, as for other React routes.

## Files added or modified in this change

New:
- frontend/pages/GenZBuzzPage.jsx
- frontend/components/BuzzNavLink.jsx
- frontend/components/BuzzNavLink.css

Modified application and tests:
- frontend/src/App.jsx — register /genz-buzz, remove homepage embed/hash navigation, position the new button.
- frontend/src/App.test.jsx — standalone/direct routes, navigation ordering, active state, independent Explore, and mobile menu state.
- frontend/pages/Explore.jsx — standalone Buzz navigation button.
- frontend/pages/Favorites.jsx — standalone Buzz navigation button.
- frontend/pages/AddSlang.jsx — standalone Buzz navigation button.
- frontend/pages/VoiceAssistant.jsx — standalone Buzz navigation button.
- frontend/components/GenZBuzz.jsx — page-level heading, dedicated section ID, Refresh News control.
- frontend/components/GenZBuzz.css — dedicated page layout and responsive heading; navbar rules moved to BuzzNavLink.css.
- frontend/components/GenZBuzz.test.jsx — updated refresh-control assertions.
- backend/services/newsService.js — newest eligible publication first, relevance as tie-breaker.
- backend/tests/news.test.js — enforce newest-first behavior even when an older item scores higher for relevance.
- README.md — dedicated-page usage and setup documentation.
- readiness-artifacts/check-news.cjs — live standalone route, navbar position, active state, reload, API, links, cache, mobile, themes and reduced-motion checks, with bounded Chrome shutdown.
- GEN_Z_BUZZ_REPORT.md — this report.

Regenerated verification artifacts:
- readiness-artifacts/news-browser.json
- readiness-artifacts/news-1440-light.png
- readiness-artifacts/news-1440-dark.png
- readiness-artifacts/news-768-light.png
- readiness-artifacts/news-768-dark.png
- readiness-artifacts/news-390-light.png
- readiness-artifacts/news-390-dark.png
- readiness-artifacts/news-375-light.png
- readiness-artifacts/news-375-dark.png

## Test results

- Backend: **105 passed**, including RSS/Atom parsing, real-field validation, newest-first selection, exactly five when available, deduplication, age filtering, cache expiry, concurrent fetch sharing, no refresh bypass, partial/total outages, and existing authentication, MongoDB, favorites, dictionary and AI proxy regression coverage.
- Frontend: **82 passed across 12 files**, including dedicated-page routing, direct URL access, button placement, active state, separate Home/Explore behavior, mobile-menu state, article data/links, loading/error/empty/retry states, image fallbacks, cancellation, polling and existing feature regressions.
- Production build: passed.
- ESLint: passed.
- Live API: five real eligible articles, newest-first order, repeated refresh=true read reused the backend cache.
- Live Chrome: homepage Buzz button sits between Explore and Favorites and opens /genz-buzz; active state is present; direct route reload works; all five rendered headlines match the API; all five publisher images loaded; all Read More URLs match API data and a real click opened the original publisher in a new tab.
- Live Chrome: Explore remains separate and its Buzz button opens the standalone page; mobile menu selection closes correctly; reduced-motion setting disables card animation; no runtime exceptions were recorded.
- Responsive checks: 375, 390, 768 and 1440 pixels in both light/dark themes, with five cards and five loaded images in every layout, and no horizontal overflow.

Reproduce the browser check with existing servers and installed Chrome:

```powershell
node readiness-artifacts/check-news.cjs
```

The browser check is read-only: it does not change MongoDB or call Gemini.

## Remaining operational limits

RSS availability, publisher image hosting, paywalls and publisher reuse terms remain external constraints. Fewer than five eligible stories are shown honestly if sources supply fewer. Relevance uses deterministic editorial filtering rather than measured social popularity. Cache is in memory per Express process and resets on restart; multi-instance hosting would require a shared cache for a global publisher request budget. Backend refresh is demand-driven, while an open news page polls automatically.
