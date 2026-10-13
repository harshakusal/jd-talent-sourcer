import os
from collections import Counter
from ..http import get_json, SourceError, log
from ..models import Candidate
from ..taxonomy import GH_LANG
from .base import Source

API = "https://api.github.com"


class GitHubSource(Source):
    name = "github"

    def __init__(self, enrich=10):
        self.enrich = enrich
        tok = os.getenv("GITHUB_TOKEN")
        self.h = {"Accept": "application/vnd.github+json"}
        if tok:
            self.h["Authorization"] = f"Bearer {tok}"

    def _query(self, p):
        q = []
        langs = [GH_LANG[s] for s in p.skills if s in GH_LANG]
        if langs:
            q.append(f"language:{langs[0]}")
        loc = (p.location or "").split(",")[0].strip()
        if loc and loc.lower() != "remote":
            q.append(f'location:"{loc}"')
        q += ["type:user", "repos:>5", "followers:>10"]
        return " ".join(q)

    def search(self, p, limit=20):
        q = self._query(p)
        data = get_json(f"{API}/search/users", {"q": q, "per_page": min(limit, 50), "sort": "followers"}, self.h)
        items = data.get("items", [])
        if not items and "location:" in q:  # relax location
            q = " ".join(t for t in q.split() if not t.startswith("location:") and '"' not in t)
            data = get_json(f"{API}/search/users", {"q": q, "per_page": min(limit, 50), "sort": "followers"}, self.h)
            items = data.get("items", [])
        out = []
        for i, it in enumerate(items[:limit]):
            c = Candidate(name=it["login"], handle=it["login"], source=self.name, profile_urls=[it["html_url"]])
            if i < self.enrich:
                try:
                    self._enrich(c)
                except SourceError as e:
                    log.warning("github enrich stopped: %s", e)
                    self.enrich = 0
            out.append(c)
        return out

    def _enrich(self, c):
        u = get_json(f"{API}/users/{c.handle}", headers=self.h)
        c.name = u.get("name") or c.handle
        c.location = u.get("location") or ""
        c.bio = " ".join(filter(None, [u.get("bio"), u.get("company")]))
        if u.get("blog"):
            c.profile_urls.append(u["blog"])
        c.signals["followers"] = u.get("followers", 0)
        c.signals["public_repos"] = u.get("public_repos", 0)
        c.signals["account_years"] = 2026 - int((u.get("created_at") or "2026")[:4])
        repos = get_json(f"{API}/users/{c.handle}/repos", {"sort": "pushed", "per_page": 30}, self.h)
        langs = Counter(r["language"].lower() for r in repos if r.get("language") and not r.get("fork"))
        topics = {t for r in repos for t in (r.get("topics") or [])}
        c.skills = [l for l, _ in langs.most_common()] + sorted(topics)
        c.bio += " " + " ".join((r.get("description") or "") for r in repos[:15])
        c.signals["stars"] = sum(r.get("stargazers_count", 0) for r in repos)
        if repos:
            c.last_active = max(r.get("pushed_at") or "" for r in repos)[:10]
