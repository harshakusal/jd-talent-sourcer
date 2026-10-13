import { Injectable } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { CandidateSource } from './source';

/** Owners (user namespaces) of recently active public GitLab projects matching the JD's skills. */
@Injectable()
export class GitLabSource implements CandidateSource {
  readonly name = 'gitlab';
  readonly enabledByDefault = true;

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const h: Record<string, string> = process.env.GITLAB_TOKEN ? { 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN } : {};
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const skill of p.skills.slice(0, 3)) {
      const projs: any[] = await getJson('https://gitlab.com/api/v4/projects', { search: skill, order_by: 'last_activity_at', per_page: 50, visibility: 'public', simple: 'true' }, h);
      for (const pr of projs) {
        const ns = pr.namespace ?? {};
        if (ns.kind !== 'user' || seen.has(ns.path)) continue;
        seen.add(ns.path);
        const c = makeCandidate({
          name: ns.name || ns.path, handle: ns.path, source: this.name, profileUrls: [ns.web_url || `https://gitlab.com/${ns.path}`],
          bio: `${pr.name ?? ''} ${pr.description ?? ''}`, skills: [skill], lastActive: (pr.last_activity_at ?? '').slice(0, 10),
        });
        c.signals.stars = pr.star_count ?? 0;
        out.push(c);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
}
