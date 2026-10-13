"""Minimal Flask UI: paste a JD, see ranked candidates, download CSV/JSON."""
import csv, io, json
from flask import Flask, request, render_template_string, Response
from .pipeline import run, row, FIELDS
from .sources import ALL, DEFAULT

app = Flask(__name__)
LAST = {}
PAGE = """<!doctype html><title>JD Talent Sourcer</title>
<style>body{font-family:sans-serif;margin:2em}textarea{width:100%;height:220px}table{border-collapse:collapse;font-size:13px}
td,th{border:1px solid #ccc;padding:4px;vertical-align:top}small{color:#666}</style>
<h2>JD Talent Sourcer</h2><form method=post><textarea name=jd placeholder="Paste job description">{{jd}}</textarea><br>
{% for s in all %}<label><input type=checkbox name=src value="{{s}}" {{'checked' if s in sel}}>{{s}}</label> {% endfor %}
| per source <input name=limit value="{{limit}}" size=3> <button>Source candidates</button></form>
{% if profile %}<p><b>{{profile.title}}</b> · {{profile.seniority}} · {{profile.location or '-'}}{{' (remote ok)' if profile.remote}}<br>
Skills: {{profile.skills|join(', ')}}<br><small>{% for k,v in status.items() %}{{k}}: {{v}} &nbsp; {% endfor %}</small></p>
<p><a href="/export.csv">Download CSV</a> · <a href="/export.json">Download JSON</a></p>
<table><tr><th>#</th><th>Score</th><th>Name</th><th>Source</th><th>Location</th><th>Matched</th><th>Breakdown</th><th>Links</th></tr>
{% for c in cands %}<tr><td>{{loop.index}}</td><td><b>{{c.score}}</b></td><td>{{c.name}}<br><small>{{c.handle}}</small></td>
<td>{{c.sources|join(', ')}}</td><td>{{c.location}}</td><td>{{c.matched_skills|join(', ')}}</td>
<td><small>{% for k,v in c.breakdown.items() %}{{k}} {{v}}<br>{% endfor %}</small></td>
<td>{% for u in c.profile_urls[:3] %}<a href="{{u}}" target=_blank>{{u[:50]}}</a><br>{% endfor %}</td></tr>{% endfor %}</table>{% endif %}"""


@app.route("/", methods=["GET", "POST"])
def index():
    ctx = dict(jd="", all=list(ALL), sel=DEFAULT, limit=15, profile=None)
    if request.method == "POST":
        ctx["jd"] = request.form["jd"]
        ctx["sel"] = request.form.getlist("src") or DEFAULT
        ctx["limit"] = int(request.form.get("limit") or 15)
        p, cands, status = run(ctx["jd"], ctx["sel"], ctx["limit"])
        LAST.update(p=p, cands=cands, status=status)
        ctx.update(profile=p, cands=cands, status=status)
    return render_template_string(PAGE, **ctx)


@app.route("/export.csv")
def export_csv():
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=FIELDS); w.writeheader()
    for c in LAST.get("cands", []):
        w.writerow(row(c))
    return Response(buf.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=candidates.csv"})


@app.route("/export.json")
def export_json():
    d = {"job": LAST["p"].to_dict() if LAST else {}, "sources": LAST.get("status", {}),
         "candidates": [c.to_dict() for c in LAST.get("cands", [])]}
    return Response(json.dumps(d, indent=2), mimetype="application/json",
                    headers={"Content-Disposition": "attachment; filename=candidates.json"})


def main():
    app.run(host="127.0.0.1", port=5000)


if __name__ == "__main__":
    main()
