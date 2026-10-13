import re
from ..http import get_json
from ..models import Candidate
from .base import Source


class RedditSource(Source):
    """[For Hire] posts on r/forhire (public JSON endpoint; optional, off by default)."""
    name = "reddit"

    def search(self, p, limit=20):
        q = "flair:\"For Hire\" " + " OR ".join(p.skills[:3])
        d = get_json("https://www.reddit.com/r/forhire/search.json",
                     {"q": q, "restrict_sr": 1, "sort": "new", "limit": limit})
        out = []
        for ch in d.get("data", {}).get("children", []):
            x = ch["data"]
            if "for hire" not in (x.get("title", "") + (x.get("link_flair_text") or "")).lower():
                continue
            out.append(Candidate(name=x["author"], handle=x["author"], source=self.name,
                                 profile_urls=[f"https://www.reddit.com/user/{x['author']}",
                                               "https://www.reddit.com" + x["permalink"]],
                                 bio=x.get("title", "") + " " + (x.get("selftext") or "")[:1500]))
        return out
