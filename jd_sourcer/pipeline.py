import concurrent.futures as cf, csv, json, re
from .extract import extract
from .scoring import score
from .sources import ALL, DEFAULT
from .http import log


def _key_urls(c):
    keys = set()
    for u in c.profile_urls:
        m = re.match(r"https?://(?:[a-z]{2,3}\.)?(github\.com|gitlab\.com|linkedin\.com/in|dev\.to)/([^/?#]+)", u or "", re.I)
        if m:
            keys.add(f"{m.group(1).lower()}/{m.group(2).lower()}")
    return keys


def dedupe(cands):
    """Merge candidates that share a canonical profile URL (e.g. GitHub link on Dev.to/HN/SO)."""
    merged, index = [], {}
    for c in cands:
        keys = _key_urls(c) | {f"{c.source}:{c.handle.lower()}"}
        hit = next((index[k] for k in keys if k in index), None)
        if hit is None:
            merged.append(c)
            hit = c
        else:
            for u in c.profile_urls:
                if u and u not in hit.profile_urls:
                    hit.profile_urls.append(u)
            hit.sources = sorted(set(hit.sources) | set(c.sources))
            hit.skills = list(dict.fromkeys(hit.skills + c.skills))
            hit.bio = (hit.bio + " " + c.bio).strip()
            hit.location = hit.location or c.location
            hit.last_active = max(filter(None, [hit.last_active, c.last_active]), default=None)
            for k, v in c.signals.items():
                hit.signals[k] = max(v, hit.signals.get(k, 0))
        for k in keys:
            index[k] = hit
    return merged


def run(jd, sources=None, limit=20, use_llm=True):
    profile = extract(jd, use_llm=use_llm)
    names = sources or DEFAULT
    status, cands = {}, []
    with cf.ThreadPoolExecutor(max_workers=len(names)) as ex:
        futs = {ex.submit(ALL[n]().search, profile, limit): n for n in names if n in ALL}
        for f in cf.as_completed(futs):
            n = futs[f]
            try:
                res = f.result()
                status[n] = f"ok ({len(res)})"
                cands += res
            except Exception as e:  # source failures never kill the run
                log.warning("source %s failed: %s", n, e)
                status[n] = f"error: {str(e)[:150]}"
    cands = dedupe(cands)
    for c in cands:
        score(profile, c)
    cands.sort(key=lambda c: -c.score)
    return profile, cands, status


FIELDS = ["score", "name", "handle", "sources", "location", "matched_skills", "profile_urls", "breakdown"]


def row(c):
    return {"score": c.score, "name": c.name, "handle": c.handle, "sources": ";".join(c.sources),
            "location": c.location, "matched_skills": ";".join(c.matched_skills),
            "profile_urls": " ".join(c.profile_urls),
            "breakdown": "; ".join(f"{k}={v}" for k, v in c.breakdown.items())}


def to_csv(cands, path):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for c in cands:
            w.writerow(row(c))


def to_json(profile, cands, status, path):
    with open(path, "w") as f:
        json.dump({"job": profile.to_dict(), "sources": status,
                   "candidates": [c.to_dict() for c in cands]}, f, indent=2)
