import re, html
from ..http import get_json
from ..models import Candidate
from .base import Source

ALG = "https://hn.algolia.com/api/v1"


class HackerNewsSource(Source):
    """Parses comments from the latest 'Ask HN: Who wants to be hired?' threads."""
    name = "hackernews"

    def search(self, p, limit=20, months=2):
        d = get_json(f"{ALG}/search_by_date", {"query": "\"Who wants to be hired\"", "tags": "story,author_whoishiring",
                                                "hitsPerPage": months})
        out = []
        for story in d.get("hits", [])[:months]:
            sid = story["objectID"]
            q = " ".join(p.skills[:2])
            hits = get_json(f"{ALG}/search", {"tags": f"comment,story_{sid}", "query": q, "hitsPerPage": limit * 2,
                                              "advancedSyntax": "true", "optionalWords": q}).get("hits", [])
            for h in hits:
                txt = html.unescape(re.sub(r"<[^>]+>", " ", h.get("comment_text") or ""))
                if "location" not in txt.lower():
                    continue
                loc = re.search(r"location\s*:\s*([^\n]+?)(?:\s{2,}|remote\s*:|$)", txt, re.I)
                urls = re.findall(r"https?://[^\s<>\"]+", txt)
                c = Candidate(name=h["author"], handle=h["author"], source=self.name,
                              profile_urls=[f"https://news.ycombinator.com/item?id={h['objectID']}"] + urls[:3],
                              location=(loc.group(1).strip()[:80] if loc else ""), bio=txt[:1500],
                              last_active=(h.get("created_at") or "")[:10])
                out.append(c)
                if len(out) >= limit:
                    return out
        return out
