/**
 * Browser-only build of jd-talent-sourcer. Reuses the exact same TypeScript as the NestJS backend
 * (taxonomy, JD parsing, source providers, scoring, dedupe, CSV export); bundled by esbuild into docs/app.js.
 */
import { ExtractService } from '../src/extract.service';
import { ScoringService } from '../src/scoring.service';
import { dedupe } from '../src/sourcing.service';
import { toCsv } from '../src/export';
import { Candidate, JobProfile } from '../src/models';
import { CandidateSource } from '../src/sources/source';
import { GitHubSource } from '../src/sources/github.source';
import { StackExchangeSource } from '../src/sources/stackexchange.source';
import { HackerNewsSource } from '../src/sources/hackernews.source';
import { GitLabSource } from '../src/sources/gitlab.source';
import { DevToSource } from '../src/sources/devto.source';
import { XRaySource } from '../src/sources/xray.source';
import { RedditSource } from '../src/sources/reddit.source';

declare const SAMPLE_JD: string;
const TOKEN_KEY = 'jdts.githubToken';

interface SourceEntry { src: CandidateSource; browser: boolean; note: string }
const SOURCES: SourceEntry[] = [
  { src: new GitHubSource(), browser: true, note: 'GitHub user search + repos (60 req/h without a token)' },
  { src: new StackExchangeSource(), browser: true, note: 'Stack Overflow top answerers by tag' },
  { src: new HackerNewsSource(), browser: true, note: 'HN “Who wants to be hired?” via Algolia' },
  { src: new GitLabSource(), browser: true, note: 'Owners of active public GitLab projects' },
  { src: new DevToSource(), browser: true, note: 'Dev.to authors by tag' },
  { src: new XRaySource(), browser: false, note: 'DuckDuckGo has no CORS headers — server version only' },
  { src: new RedditSource(), browser: false, note: 'Reddit JSON has no CORS headers — server version only' },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
let last: { job: JobProfile; sources: Record<string, string>; candidates: Candidate[] } | null = null;

function applyToken() {
  const t = localStorage.getItem(TOKEN_KEY) || '';
  (globalThis as any).process.env.GITHUB_TOKEN = t || undefined;
  $('tokenState').textContent = t ? 'token saved in this browser' : 'no token (60 GitHub requests/hour)';
}

function renderSources() {
  $('sources').innerHTML = SOURCES.map(({ src, browser, note }) => `
    <label class="src ${browser ? '' : 'disabled'}" title="${esc(note)}">
      <input type="checkbox" value="${src.name}" ${browser ? 'checked' : 'disabled'}>
      <span>${esc(src.name)}</span>${browser ? '' : '<em>CORS-blocked</em>'}
    </label>`).join('');
}

function describeError(e: any): string {
  const m = String(e?.message ?? e);
  if (/failed to fetch|networkerror|load failed|network error/i.test(m)) return 'blocked (CORS or network) in this browser';
  return m.slice(0, 160);
}

async function run() {
  const jd = $<HTMLTextAreaElement>('jd').value;
  if (jd.trim().length < 20) { $('status').innerHTML = '<span class="err">Paste a job description first.</span>'; return; }
  const limit = Math.min(Math.max(+$<HTMLInputElement>('limit').value || 15, 1), 50);
  const chosen = [...document.querySelectorAll<HTMLInputElement>('#sources input:checked')].map((i) => i.value);
  const entries = SOURCES.filter((s) => s.browser && chosen.includes(s.src.name));
  applyToken();
  $<HTMLButtonElement>('go').disabled = true;
  $('status').innerHTML = '<span class="spin"></span> Searching ' + entries.map((e) => e.src.name).join(', ') + '…';
  try {
    const job = await new ExtractService().extract(jd, false);
    const sources: Record<string, string> = {};
    const settled = await Promise.allSettled(entries.map((e) => e.src.search(job, limit)));
    const all: Candidate[] = [];
    settled.forEach((r, i) => {
      const n = entries[i].src.name;
      if (r.status === 'fulfilled') { sources[n] = `ok (${r.value.length})`; all.push(...r.value); }
      else sources[n] = `error: ${describeError(r.reason)}`;
    });
    for (const s of SOURCES) if (!s.browser) sources[s.src.name] = 'skipped: blocked by CORS in the browser';
    const scorer = new ScoringService();
    const candidates = dedupe(all).map((c) => scorer.score(job, c)).sort((a, b) => b.score - a.score);
    last = { job, sources, candidates };
    render();
  } catch (e) {
    $('status').innerHTML = `<span class="err">${esc(describeError(e))}</span>`;
  } finally { $<HTMLButtonElement>('go').disabled = false; }
}

function render() {
  if (!last) return;
  const { job, sources, candidates } = last;
  $('status').innerHTML = '';
  $('summary').innerHTML = `
    <div class="card job">
      <div><span class="k">Role</span><b>${esc(job.title || '—')}</b></div>
      <div><span class="k">Seniority</span>${esc(job.seniority)}</div>
      <div><span class="k">Location</span>${esc(job.location || '—')}${job.remote ? ' <span class="pill">remote ok</span>' : ''}</div>
      <div class="wide"><span class="k">Skills</span>${job.skills.map((s) => `<span class="chip ${job.mustHave.includes(s) ? 'must' : ''}">${esc(s)}</span>`).join('')}</div>
      <div class="wide"><span class="k">Sources</span>${Object.entries(sources).map(([k, v]) =>
        `<span class="badge ${v.startsWith('ok') ? 'ok' : v.startsWith('skipped') ? 'skip' : 'err'}" title="${esc(v)}">${esc(k)}: ${esc(v.startsWith('ok') ? v : v.split(':')[0])}</span>`).join('')}</div>
    </div>
    <div class="bar"><b>${candidates.length}</b> candidates ·
      <button class="btn ghost" id="dlCsv">Download CSV</button><button class="btn ghost" id="dlJson">Download JSON</button></div>`;
  $('dlCsv').onclick = () => download('candidates.csv', toCsv(candidates), 'text/csv');
  $('dlJson').onclick = () => download('candidates.json', JSON.stringify({ ...last, count: candidates.length }, null, 2), 'application/json');
  $('results').innerHTML = `<div class="tablewrap"><table><thead><tr><th>#</th><th>Score</th><th>Candidate</th><th>Source</th><th>Location</th><th>Matched skills</th><th>Breakdown</th><th>Links</th></tr></thead><tbody>${
    candidates.map((c, i) => `<tr>
      <td class="muted">${i + 1}</td>
      <td><span class="score" style="--s:${c.score}">${c.score}</span></td>
      <td><b>${esc(c.name)}</b><br><small>${esc(c.handle)}</small></td>
      <td>${c.sources.map((s) => `<span class="pill">${esc(s)}</span>`).join(' ')}</td>
      <td>${esc(c.location)}</td>
      <td>${c.matchedSkills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</td>
      <td class="bd">${Object.entries(c.breakdown).map(([k, v]) => `<div><span>${esc(k.replace('_', ' '))}</span><b>${v}</b></div>`).join('')}</td>
      <td>${c.profileUrls.slice(0, 3).filter((u) => /^https?:/.test(u)).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42))}</a>`).join('<br>')}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function download(name: string, body: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSources();
  $<HTMLInputElement>('token').value = localStorage.getItem(TOKEN_KEY) || '';
  applyToken();
  $('saveToken').onclick = () => {
    const v = $<HTMLInputElement>('token').value.trim();
    v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY);
    applyToken();
  };
  $('clearToken').onclick = () => { localStorage.removeItem(TOKEN_KEY); $<HTMLInputElement>('token').value = ''; applyToken(); };
  $('sample').onclick = () => { $<HTMLTextAreaElement>('jd').value = SAMPLE_JD; };
  $('go').onclick = run;
});
