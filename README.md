# jd-talent-sourcer

Paste a job description → extract role/skills/seniority/location → source candidates from **free, public** sources → rank them with a transparent 0–100 fit score → export CSV/JSON.

## Setup
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Usage
CLI (file or stdin):
```bash
python -m jd_sourcer samples/sample_jd.txt --csv out.csv --json out.json
cat jd.txt | python -m jd_sourcer -s github,stackexchange,hackernews -n 25 --top 30
python -m jd_sourcer --help
```
Web UI (Flask, paste box + ranked table + CSV/JSON download):
```bash
python -m jd_sourcer.web   # http://127.0.0.1:5000
```
Tests: `pytest -q`

## JD extraction
Keyword / skill-taxonomy based (`jd_sourcer/taxonomy.py`, ~70 skills with aliases): title, seniority (junior…principal, also inferred from "N+ years"), location, remote flag, skills, and must-have skills (skills before a "Nice to have / Preferred" section get 2× weight).
If `OPENAI_API_KEY` is set, an LLM extraction is merged on top (`OPENAI_MODEL`, default `gpt-4o-mini`). Use `--no-llm` to disable. Works fully without it.

## Sources (pluggable: `jd_sourcer/sources/*.py`, subclass `Source`, register in `sources/__init__.py`)
| name | what | auth |
|---|---|---|
| `github` | User search API (language + location + followers/repos), enriched with profile, repo languages/topics, stars, last push | optional `GITHUB_TOKEN` (60 → 5000 req/h) |
| `stackexchange` | Top all-time answerers for the JD's tags on Stack Overflow + profile (reputation, location, last access) | optional `STACKEXCHANGE_KEY` (300 → 10k req/day) |
| `hackernews` | Comments in the latest monthly "Ask HN: Who wants to be hired?" threads via Algolia HN API | none |
| `gitlab` | Owners of recently active public projects matching skills | optional `GITLAB_TOKEN` |
| `devto` | Dev.to authors on the JD's skill tags (Forem API), with linked GitHub handle | none |
| `xray` | DuckDuckGo X-ray (`site:linkedin.com/in`, `site:github.com`) via `ddgs` – returns **public profile URLs + search snippet only** | none |
| `reddit` | r/forhire `[For Hire]` posts (opt-in: `-s ...,reddit`) | none |

Not included: Kaggle and Hashnode (no public user-search API), Wellfound (no API).

Each source runs in parallel; rate limits (429/403 + `Retry-After`/`X-RateLimit-Reset`) are retried briefly, and any source failure is reported in the status line but never kills the run. Candidates are deduped across sources by canonical GitHub/GitLab/LinkedIn/Dev.to URL.

## Fit score (0–100)
| component | max | basis |
|---|---|---|
| skills | 50 | weighted overlap of JD skills (must-have 2×) with bio, repo languages/topics, SO tags, post text |
| seniority | 15 | stated years/titles, else account age / reputation vs. JD level (unknown = neutral) |
| location | 15 | match to JD city (Bangalore≈Bengaluru etc.), remote-aware; unknown = 6 |
| activity | 10 | recency of last push / post / access |
| source_signals | 10 | log-scaled stars, followers, reputation, reactions |

Every candidate carries its `breakdown` in the UI, CSV and JSON.

## Env vars
`GITHUB_TOKEN`, `STACKEXCHANGE_KEY`, `GITLAB_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL` – all optional.

## Ethics / ToS
- Uses only official public APIs and public search results; respects rate limits. Do **not** scrape LinkedIn or other sites that prohibit it — the X-ray source only stores URLs and snippets returned by the search engine.
- Data is public but still personal data: use it only for legitimate recruiting outreach, keep it minimal, honour opt-outs and GDPR/DPDP obligations, and don't resell it.
- Scores are heuristics on sparse public signals — a starting point for human review, not a hiring decision. Avoid using them in ways that encode bias (e.g. by location or profile visibility).
