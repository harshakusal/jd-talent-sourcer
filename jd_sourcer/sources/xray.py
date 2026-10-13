import re
from ..models import Candidate
from .base import Source


class XRaySource(Source):
    """DuckDuckGo X-ray search. Returns PUBLIC profile URLs + search snippet only; never scrapes the profiles."""
    name = "xray"
    SITES = {"linkedin": "site:linkedin.com/in", "github": "site:github.com"}

    def search(self, p, limit=20):
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS  # older package name
        out = []
        sk = " ".join(p.skills[:2])
        loc = p.location.split(",")[0].strip() if p.location and p.location.lower() != "remote" else ""
        errors = []
        for site, op in self.SITES.items():
            # keep queries short: long quoted X-ray queries usually return nothing from DDG
            results = []
            for q in [f"{op} {sk} {loc}", f"{op} {sk}"]:
                try:
                    results = DDGS().text(q.strip(), max_results=max(5, limit // 2)) or []
                except Exception as e:
                    errors.append(f"{site}: {e}")
                if results:
                    break
            for r in results:
                url = r.get("href", "")
                if site == "linkedin" and "/in/" not in url:
                    continue
                if site == "github" and not re.match(r"https://github\.com/[^/]+/?$", url):
                    continue
                handle = url.rstrip("/").split("/")[-1]
                name = re.split(r" [-|–·] |\.\.\.", r.get("title", handle))[0].strip()
                if "linkedin.com" in url:
                    url = "https://www.linkedin.com/in/" + handle
                out.append(Candidate(name=name, handle=handle, source=f"xray:{site}", profile_urls=[url],
                                     bio=(r.get("title", "") + " " + r.get("body", ""))))
        if not out and errors:
            raise RuntimeError("; ".join(errors)[:300])
        return out
