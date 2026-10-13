from ..http import get_json
from ..models import Candidate
from .base import Source

API = "https://dev.to/api"


class DevToSource(Source):
    """Dev.to authors writing on the JD's top skill tags (public Forem API)."""
    name = "devto"

    def search(self, p, limit=20):
        authors = {}
        for skill in p.skills[:3]:
            tag = skill.replace(" ", "").replace(".", "").replace("/", "").replace("+", "plus").replace("#", "sharp")
            arts = get_json(f"{API}/articles", {"tag": tag, "top": 365, "per_page": 30})
            for a in arts:
                u = a.get("user") or {}
                if not u.get("username"):
                    continue
                e = authors.setdefault(u["username"], {"u": u, "tags": set(), "reactions": 0, "last": ""})
                e["tags"].update(a.get("tag_list") or [])
                e["reactions"] += a.get("positive_reactions_count", 0)
                e["last"] = max(e["last"], (a.get("published_at") or "")[:10])
        out = []
        for name, e in sorted(authors.items(), key=lambda kv: -kv[1]["reactions"])[:limit]:
            u = e["u"]
            urls = [f"https://dev.to/{name}"]
            if u.get("github_username"):
                urls.append(f"https://github.com/{u['github_username']}")
            c = Candidate(name=u.get("name") or name, handle=name, source=self.name, profile_urls=urls,
                          skills=sorted(e["tags"]), last_active=e["last"])
            c.signals["reactions"] = e["reactions"]
            out.append(c)
        return out
