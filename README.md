# jd-talent-sourcer (NestJS)

Paste a job description → extract role / skills / seniority / location → source candidates from **free, public** sources → rank with a transparent 0–100 fit score → export CSV / JSON.

## Browser-only version (GitHub Pages)
**Live: https://harshakusal.github.io/jd-talent-sourcer/** – a static build in `/docs` that runs fully in the browser (no server).
It reuses the same TypeScript as the backend (taxonomy, JD parsing, source providers, scoring, dedupe, CSV export), bundled by esbuild into `docs/app.js` (`npm run build:web`; `@nestjs/common` is swapped for a tiny shim in `web/nest-shim.ts`).
- Works in the browser: **GitHub, Stack Exchange, HN (Algolia), GitLab, Dev.to** (all send CORS headers).
- Skipped in the browser (no CORS headers; marked in the UI): **DuckDuckGo X-ray, Reddit** – use the NestJS server for those.
- Optional GitHub token is stored only in your browser's `localStorage` and sent only to `api.github.com`. The OpenAI LLM option is server-only.

## Setup
```bash
npm install
npm run build
npm start                 # http://localhost:3000  (PORT / HOST env vars)
npm run start:dev         # watch mode
npm test                  # jest (unit + API tests with mocked sources; no network)
```

## Usage
**Web UI** – open `/`: paste a JD, choose sources, see the ranked table, download CSV/JSON.

**API**
```bash
curl -X POST localhost:3000/api/source -H 'Content-Type: application/json' \
  -d "{\"jd\": $(jq -Rs . < samples/sample_jd.txt), \"sources\": [\"github\",\"stackexchange\"], \"limit\": 15}"
```
| endpoint | |
|---|---|
| `POST /api/source` | body `{ jd, sources?, limit? (1–50, per source), useLlm? }` → `{ job, sources (per-source status), count, candidates[] }`. Add `?format=csv` for CSV. |
| `GET /api/export.csv`, `GET /api/export.json` | export of the last run |
| `GET /api/sources` | available sources and defaults |
| `GET /api/health` | health check |

**CLI**: `node dist/cli.js samples/sample_jd.txt --sources github,stackexchange --limit 15 --top 20 --csv out.csv --json out.json`

## JD parsing
Skill taxonomy (`src/taxonomy.ts`, ~70 skills with aliases) plus heuristics for title, seniority (junior…principal, also from "N+ years"), location, remote, and must-have skills (skills before a "Nice to have / Preferred" section get 2× weight).
If `OPENAI_API_KEY` is set, an LLM extraction (`OPENAI_MODEL`, default `gpt-4o-mini`) is merged on top. Everything works without it.

## Sources
Each source is an injectable NestJS provider in `src/sources/` implementing `CandidateSource` (`name`, `enabledByDefault`, `search()`), registered in `sources.module.ts`.

| name | what | auth |
|---|---|---|
| `github` | User search API (language + location + followers/repos), enriched with profile, repo languages/topics, stars, last push | optional `GITHUB_TOKEN` (60 → 5000 req/h) |
| `stackexchange` | Top all-time answerers for the JD's tags on Stack Overflow + profile (reputation, location, last access) | optional `STACKEXCHANGE_KEY` |
| `hackernews` | Comments in the latest monthly "Ask HN: Who wants to be hired?" threads via Algolia HN API | none |
| `gitlab` | Owners of recently active public projects matching the skills | optional `GITLAB_TOKEN` |
| `devto` | Dev.to authors on the JD's skill tags (Forem API), with linked GitHub handle | none |
| `xray` | DuckDuckGo X-ray via the HTML endpoint (`site:linkedin.com/in`, `site:github.com`): **public profile URLs + search snippet only** | none |
| `reddit` | r/forhire `[For Hire]` posts – **off by default**, request with `sources: ["reddit"]` | none |

Not included: Kaggle and Hashnode (no public user-search API), Wellfound (no API).

Sources run in parallel. Rate limits (429 / exhausted GitHub quota, `Retry-After` / `X-RateLimit-Reset`) get a short backoff, and a failing source is reported in `sources` (`"error: …"`) without failing the request. Candidates are deduped across sources by canonical GitHub / GitLab / LinkedIn / Dev.to URL.

## Fit score (0–100)
| component | max | basis |
|---|---|---|
| skills | 50 | weighted overlap of JD skills (must-have 2×) with bio, repo languages/topics, SO tags, post text |
| seniority | 15 | stated years/titles, else account age / reputation vs. JD level (unknown = neutral) |
| location | 15 | match to JD city (Bangalore≈Bengaluru etc.), remote-aware; unknown = 6 |
| activity | 10 | recency of last push / post / access |
| source_signals | 10 | log-scaled stars, followers, reputation, reactions |

Each candidate includes its `breakdown` in the UI, JSON and CSV.

## Deploy (free)
- **Docker**: `docker build -t jd-talent-sourcer . && docker run -p 3000:3000 -e GITHUB_TOKEN=... jd-talent-sourcer`
- **Render**: New → Blueprint → select this repo; `render.yaml` defines a free Docker web service (health check `/api/health`). Set the optional env vars in the dashboard.

## Env vars
`PORT` (3000), `HOST` (0.0.0.0), `GITHUB_TOKEN`, `STACKEXCHANGE_KEY`, `GITLAB_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL` – all optional.

## Ethics / ToS
- Uses only official public APIs and public search results, and respects rate limits. Do **not** scrape LinkedIn or other sites that forbid it; the X-ray source stores only URLs and snippets returned by the search engine.
- Public data is still personal data: use it only for legitimate recruiting outreach, keep it minimal, honour opt-outs and GDPR / India DPDP obligations, and don't resell it.
- Scores are heuristics on sparse public signals, meant as a starting point for human review, not a hiring decision. Watch for bias (e.g. by location or profile visibility).
