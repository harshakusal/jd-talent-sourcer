import os
from ..http import get_json
from ..models import Candidate
from .base import Source

API = "https://gitlab.com/api/v4"


class GitLabSource(Source):
    """Public project search by skill keyword; candidates are project owners/namespaces (users only)."""
    name = "gitlab"

    def search(self, p, limit=20):
        h = {"PRIVATE-TOKEN": os.environ["GITLAB_TOKEN"]} if os.getenv("GITLAB_TOKEN") else {}
        seen, out = set(), []
        for skill in p.skills[:3]:
            projs = get_json(f"{API}/projects", {"search": skill, "order_by": "last_activity_at", "per_page": 50,
                                                 "visibility": "public", "simple": "true"}, h)
            for pr in projs:
                ns = pr.get("namespace") or {}
                if ns.get("kind") != "user" or ns["path"] in seen:
                    continue
                seen.add(ns["path"])
                c = Candidate(name=ns.get("name") or ns["path"], handle=ns["path"], source=self.name,
                              profile_urls=[ns.get("web_url") or f"https://gitlab.com/{ns['path']}"],
                              bio=(pr.get("name", "") + " " + (pr.get("description") or "")), skills=[skill],
                              last_active=(pr.get("last_activity_at") or "")[:10])
                c.signals["stars"] = pr.get("star_count", 0)
                out.append(c)
                if len(out) >= limit:
                    return out
        return out
