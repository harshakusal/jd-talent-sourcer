import { Injectable, Logger } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { GH_LANG } from '../taxonomy';
import { CandidateSource } from './source';

const API = 'https://api.github.com';

@Injectable()
export class GitHubSource implements CandidateSource {
  readonly name = 'github';
  readonly enabledByDefault = true;
  private log = new Logger('GitHub');
  enrich = 10;

  private headers() {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    return h;
  }

  buildQuery(p: JobProfile, withLocation = true): string {
    const q: string[] = [];
    const lang = p.skills.map((s) => GH_LANG[s]).find(Boolean);
    if (lang) q.push(`language:${lang}`);
    const loc = (p.location || '').split(',')[0].trim();
    if (withLocation && loc && loc.toLowerCase() !== 'remote') q.push(`location:"${loc}"`);
    q.push('type:user', 'repos:>5', 'followers:>10');
    return q.join(' ');
  }

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const h = this.headers();
    const run = (q: string) => getJson(`${API}/search/users`, { q, per_page: Math.min(limit, 50), sort: 'followers' }, h);
    let items: any[] = (await run(this.buildQuery(p))).items ?? [];
    if (!items.length && p.location) items = (await run(this.buildQuery(p, false))).items ?? [];
    const out = items.slice(0, limit).map((it) => makeCandidate({ name: it.login, handle: it.login, source: this.name, profileUrls: [it.html_url] }));
    const n = Math.min(this.enrich, out.length);
    await Promise.all(out.slice(0, n).map((c) => this.enrichOne(c, h).catch((e) => this.log.warn(`enrich ${c.handle}: ${e.message}`))));
    return out;
  }

  private async enrichOne(c: Candidate, h: Record<string, string>) {
    const [u, repos] = await Promise.all([
      getJson(`${API}/users/${c.handle}`, undefined, h),
      getJson<any[]>(`${API}/users/${c.handle}/repos`, { sort: 'pushed', per_page: 30 }, h),
    ]);
    c.name = u.name || c.handle;
    c.location = u.location || '';
    c.bio = [u.bio, u.company].filter(Boolean).join(' ');
    if (u.blog) c.profileUrls.push(u.blog);
    c.signals.followers = u.followers ?? 0;
    c.signals.public_repos = u.public_repos ?? 0;
    c.signals.account_years = new Date().getFullYear() - +(u.created_at ?? '2026').slice(0, 4);
    const langs = new Map<string, number>();
    for (const r of repos) if (r.language && !r.fork) langs.set(r.language.toLowerCase(), (langs.get(r.language.toLowerCase()) ?? 0) + 1);
    const topics = new Set(repos.flatMap((r) => r.topics ?? []));
    c.skills = [...[...langs.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]), ...[...topics].sort()];
    c.bio += ' ' + repos.slice(0, 15).map((r) => r.description ?? '').join(' ');
    c.signals.stars = repos.reduce((a, r) => a + (r.stargazers_count ?? 0), 0);
    if (repos.length) c.lastActive = repos.map((r) => r.pushed_at ?? '').sort().pop()!.slice(0, 10);
  }
}
