import argparse, logging, sys
from .pipeline import run, to_csv, to_json
from .sources import ALL, DEFAULT


def main(argv=None):
    ap = argparse.ArgumentParser(prog="jd-sourcer", description="Source candidates for a job description.")
    ap.add_argument("jd", nargs="?", help="JD file (default: stdin)")
    ap.add_argument("-s", "--sources", default=",".join(DEFAULT), help=f"comma list from: {','.join(ALL)}")
    ap.add_argument("-n", "--limit", type=int, default=20, help="max candidates per source")
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--csv"); ap.add_argument("--json")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO if a.verbose else logging.WARNING, format="%(levelname)s %(message)s")
    for noisy in ("ddgs", "primp", "httpx", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    jd = open(a.jd).read() if a.jd and a.jd != "-" else sys.stdin.read()
    profile, cands, status = run(jd, [s.strip() for s in a.sources.split(",")], a.limit, not a.no_llm)
    print(f"Role: {profile.title} | seniority: {profile.seniority} | location: {profile.location or '-'}"
          f"{' (remote ok)' if profile.remote else ''}\nSkills: {', '.join(profile.skills)}\n"
          f"Must-have: {', '.join(profile.must_have)}")
    print("Sources: " + ", ".join(f"{k}={v}" for k, v in status.items()) + "\n")
    print(f"{'#':>3} {'score':>5}  {'name':28} {'source':22} {'location':22} matched / url")
    for i, c in enumerate(cands[:a.top], 1):
        print(f"{i:>3} {c.score:>5}  {c.name[:28]:28} {','.join(c.sources)[:22]:22} {c.location[:22]:22} "
              f"{','.join(c.matched_skills)} {c.profile_urls[0] if c.profile_urls else ''}")
    if a.csv: to_csv(cands, a.csv); print(f"\nCSV -> {a.csv}")
    if a.json: to_json(profile, cands, status, a.json); print(f"JSON -> {a.json}")


if __name__ == "__main__":
    main()
