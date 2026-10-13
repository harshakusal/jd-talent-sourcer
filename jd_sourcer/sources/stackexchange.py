import os, re, datetime as dt
from ..http import get_json
from ..models import Candidate
from ..taxonomy import so_tag
from .base import Source

API = "https://api.stackexchange.com/2.3"


class StackExchangeSource(Source):
    name = "stackexchange"

    def search(self, p, limit=20):
        key = os.getenv("STACKEXCHANGE_KEY")
        base = {"site": "stackoverflow"}
        if key:
            base["key"] = key
        users = {}
        for skill in p.skills[:3]:
            tag = so_tag(skill)
            try:
                d = get_json(f"{API}/tags/{tag}/top-answerers/all_time", dict(base, pagesize=limit))
            except Exception:
                continue
            for it in d.get("items", []):
                u = it["user"]
                if u.get("user_id"):
                    e = users.setdefault(u["user_id"], {"u": u, "tags": set(), "score": 0})
                    e["tags"].add(skill)
                    e["score"] += it.get("score", 0)
        if not users:
            return []
        ids = sorted(users, key=lambda k: -users[k]["score"])[:min(100, limit * 2)]
        detail = get_json(f"{API}/users/{';'.join(map(str, ids))}", dict(base, pagesize=100)).get("items", [])
        out = []
        for u in detail:
            e = users[u["user_id"]]
            la = u.get("last_access_date")
            c = Candidate(name=re.sub("&#39;", "'", u.get("display_name", "")), handle=str(u["user_id"]),
                          source=self.name, profile_urls=[u.get("link", "")], location=u.get("location") or "",
                          skills=sorted(e["tags"]),
                          last_active=dt.datetime.utcfromtimestamp(la).date().isoformat() if la else None)
            if u.get("website_url"):
                c.profile_urls.append(u["website_url"])
            c.signals["reputation"] = u.get("reputation", 0)
            c.signals["tag_score"] = e["score"]
            out.append(c)
        return out
