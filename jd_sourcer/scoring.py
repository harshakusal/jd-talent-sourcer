"""Transparent 0-100 fit score. Weights sum to 100."""
import datetime as dt, math, re
from .extract import find_skills
from .taxonomy import normalize

WEIGHTS = {"skills": 50, "seniority": 15, "location": 15, "activity": 10, "source_signals": 10}
LEVEL = {"junior": 1, "mid": 2, "senior": 3, "lead": 4, "staff": 4, "principal": 5}


def candidate_skills(c):
    s = set(find_skills(c.text()))
    for raw in c.skills:
        n = normalize(raw) or (raw.lower() if raw else None)
        if n:
            s.add(n)
    return s


def _skills(p, c):
    have = candidate_skills(c)
    if not p.skills:
        return 0.0, []
    matched = [s for s in p.skills if s in have]
    must = p.must_have or p.skills
    w = {s: (2.0 if s in must else 1.0) for s in p.skills}
    return sum(w[s] for s in matched) / sum(w.values()), matched


def _seniority(p, c):
    target = LEVEL.get(p.seniority, 2)
    est = 0
    t = c.text()
    m = re.findall(r"(\d{1,2})\+?\s*(?:years|yrs|yoe)", t)
    if m:
        y = max(int(x) for x in m)
        est = 1 if y < 2 else 2 if y < 5 else 3 if y < 9 else 4
    elif re.search(r"\b(principal|staff|architect|cto|head of)\b", t):
        est = 4
    elif re.search(r"\b(senior|sr\.?|lead)\b", t):
        est = 3
    else:
        sig = c.signals
        yrs = sig.get("account_years", 0)
        rep = sig.get("reputation", 0)
        if yrs >= 10 or rep >= 50000:
            est = 4
        elif yrs >= 6 or rep >= 10000:
            est = 3
        elif yrs >= 3 or rep >= 1000:
            est = 2
    if not est:
        return 0.5  # unknown -> neutral
    return max(0.0, 1 - abs(est - target) * 0.3)


def _location(p, c):
    if not p.location or p.location.lower() == "remote":
        return 1.0 if p.remote or not p.location else 0.5
    want = [w.strip().lower() for w in re.split(r"[,/]", p.location) if w.strip()]
    loc = (c.location or "").lower()
    alias = {"bangalore": "bengaluru", "bengaluru": "bangalore", "gurgaon": "gurugram", "bombay": "mumbai"}
    if loc:
        if any(w in loc or alias.get(w, "#") in loc for w in want):
            return 1.0
        if p.remote and "remote" in loc:
            return 0.8
        return 0.2 if not p.remote else 0.5
    return 0.4  # unknown


def _activity(c):
    if not c.last_active:
        return 0.4
    try:
        d = dt.date.fromisoformat(c.last_active[:10])
    except ValueError:
        return 0.4
    days = (dt.date.today() - d).days
    return 1.0 if days <= 30 else 0.8 if days <= 90 else 0.6 if days <= 365 else 0.3 if days <= 730 else 0.1


def _signals(c):
    s = c.signals
    def lg(v, cap):
        return min(1.0, math.log10(1 + v) / math.log10(1 + cap))
    vals = []
    if "stars" in s: vals.append(lg(s["stars"], 5000))
    if "followers" in s: vals.append(lg(s["followers"], 5000))
    if "reputation" in s: vals.append(lg(s["reputation"], 200000))
    if "reactions" in s: vals.append(lg(s["reactions"], 2000))
    return sum(vals) / len(vals) if vals else 0.3


def score(p, c):
    sk, matched = _skills(p, c)
    parts = {"skills": sk, "seniority": _seniority(p, c), "location": _location(p, c),
             "activity": _activity(c), "source_signals": _signals(c)}
    c.matched_skills = matched
    c.breakdown = {k: round(v * WEIGHTS[k], 1) for k, v in parts.items()}
    c.score = round(sum(c.breakdown.values()), 1)
    return c
