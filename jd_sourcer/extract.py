import json, os, re
from .models import JobProfile
from .taxonomy import SKILLS

SENIORITY = [("principal", ["principal", "distinguished", "architect"]), ("staff", ["staff"]),
             ("lead", ["lead", "head of", "manager"]), ("senior", ["senior", "sr.", "sr "]),
             ("junior", ["junior", "jr.", "entry level", "graduate", "intern"])]
TITLE_RE = re.compile(r"((?:senior|sr\.?|junior|jr\.?|lead|staff|principal)?\s*[\w\+\#\./ -]{0,40}?"
                      r"(?:engineer|developer|scientist|architect|analyst|designer|manager|devops|sre))", re.I)
LOC_RE = re.compile(r"(?:location|based in|located in|office in)\s*[:\-]?\s*([A-Z][\w .,'-]{1,60})", re.I)
CITIES = ["bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "delhi", "chennai", "gurgaon", "noida",
          "london", "berlin", "paris", "amsterdam", "new york", "san francisco", "seattle", "austin", "boston",
          "toronto", "vancouver", "singapore", "sydney", "dublin", "tel aviv", "remote"]


def find_skills(text: str):
    t = " " + re.sub(r"[\(\),;/|•\n]", " ", text.lower()) + " "
    found = {}
    for canon, aliases in SKILLS.items():
        for a in [canon] + aliases:
            a2 = a if a.startswith(" ") else a
            pat = re.escape(a2.strip())
            if re.search(r"(?<![\w\+\#])" + pat + r"(?![\w\+\#])", t):
                found[canon] = t.find(a2.strip())
                break
    return [k for k, _ in sorted(found.items(), key=lambda kv: kv[1])]


def heuristic_extract(jd: str) -> JobProfile:
    low = jd.lower()
    skills = find_skills(jd)
    # must-have: skills in "requirements"/"must" section before "nice to have"
    req = re.split(r"nice to have|bonus|preferred|plus:", low)[0]
    must = [s for s in skills if s in find_skills(req)]
    title = ""
    first = [l.strip() for l in jd.splitlines() if l.strip()][:5]
    for line in first + [jd]:
        m = TITLE_RE.search(line)
        if m:
            title = re.sub(r"^(title|role|position)\s*[:\-]\s*", "", m.group(1).strip(), flags=re.I).strip(" -:")
            break
    seniority = "mid"
    scope = (title + " " + low[:400]).lower()
    for lvl, kws in SENIORITY:
        if any(k in scope for k in kws):
            seniority = lvl
            break
    years = [int(y) for y in re.findall(r"(\d{1,2})\+?\s*(?:-\s*\d+\s*)?years", low)]
    min_years = min(years) if years else None
    if min_years and seniority == "mid":
        seniority = "senior" if min_years >= 5 else ("junior" if min_years <= 1 else "mid")
    location = ""
    m = LOC_RE.search(jd)
    if m:
        location = m.group(1).split("\n")[0].strip().rstrip(".")
    else:
        for c in CITIES:
            if c != "remote" and c in low:
                location = c.title()
                break
    remote = "remote" in low
    return JobProfile(title=title, seniority=seniority, skills=skills, must_have=must or skills[:5],
                      location=location, remote=remote, min_years=min_years)


def llm_extract(jd: str):
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    import requests
    prompt = ("Extract from this job description a JSON object with keys: title, seniority "
              "(junior|mid|senior|lead|staff|principal), skills (list of lowercase skill names), must_have (list), "
              "location (city/country or empty), remote (bool), min_years (int or null). JD:\n" + jd[:8000])
    try:
        r = requests.post("https://api.openai.com/v1/chat/completions", timeout=60,
                          headers={"Authorization": f"Bearer {key}"},
                          json={"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                                "response_format": {"type": "json_object"},
                                "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        d = json.loads(r.json()["choices"][0]["message"]["content"])
        return JobProfile(title=d.get("title", ""), seniority=d.get("seniority", "mid"),
                          skills=[s.lower() for s in d.get("skills", [])],
                          must_have=[s.lower() for s in d.get("must_have", [])],
                          location=d.get("location") or "", remote=bool(d.get("remote")),
                          min_years=d.get("min_years"))
    except Exception:
        return None


def extract(jd: str, use_llm: bool = True) -> JobProfile:
    base = heuristic_extract(jd)
    llm = llm_extract(jd) if use_llm else None
    if llm:
        # merge: LLM fields win where present, union skills
        for s in base.skills:
            if s not in llm.skills:
                llm.skills.append(s)
        llm.location = llm.location or base.location
        llm.title = llm.title or base.title
        return llm
    return base
