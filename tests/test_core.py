from jd_sourcer.extract import heuristic_extract
from jd_sourcer.models import Candidate, JobProfile
from jd_sourcer.scoring import score
from jd_sourcer.pipeline import dedupe

JD = open("samples/sample_jd.txt").read()


def test_extract():
    p = heuristic_extract(JD)
    assert "python" in p.skills and "django" in p.skills and "kubernetes" in p.skills
    assert p.seniority == "senior"
    assert "Bangalore" in p.location
    assert "kafka" not in p.must_have and "python" in p.must_have
    assert "engineer" in p.title.lower()


def test_score_bounds_and_ordering():
    p = heuristic_extract(JD)
    good = Candidate(name="A", handle="a", source="github", location="Bengaluru, India",
                     bio="Senior engineer, 8 years Python Django Postgres AWS Kubernetes Docker",
                     last_active="2026-10-01", signals={"stars": 500, "followers": 300})
    bad = Candidate(name="B", handle="b", source="github", location="Paris", bio="PHP dev")
    score(p, good); score(p, bad)
    assert 0 <= bad.score < good.score <= 100
    assert set(good.breakdown) == {"skills", "seniority", "location", "activity", "source_signals"}
    assert abs(sum(good.breakdown.values()) - good.score) < 0.2


def test_dedupe_by_github_url():
    a = Candidate(name="x", handle="octo", source="github", profile_urls=["https://github.com/Octo"])
    b = Candidate(name="x", handle="octo_dev", source="devto",
                  profile_urls=["https://dev.to/octo_dev", "https://github.com/octo"])
    m = dedupe([a, b])
    assert len(m) == 1 and set(m[0].sources) == {"github", "devto"}


def test_source_failure_is_isolated(monkeypatch):
    from jd_sourcer import pipeline
    from jd_sourcer.sources.base import Source

    class Boom(Source):
        name = "boom"
        def search(self, p, limit=20): raise RuntimeError("down")

    class Ok(Source):
        name = "ok"
        def search(self, p, limit=20): return [Candidate(name="c", handle="c", source="ok", bio="python")]

    monkeypatch.setitem(pipeline.ALL, "boom", Boom)
    monkeypatch.setitem(pipeline.ALL, "ok", Ok)
    p, cands, status = pipeline.run(JD, ["boom", "ok"], use_llm=False)
    assert status["boom"].startswith("error") and len(cands) == 1
