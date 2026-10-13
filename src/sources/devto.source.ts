import { Injectable } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { CandidateSource } from './source';

/** Dev.to authors writing on the JD's top skill tags (public Forem API). */
@Injectable()
export class DevToSource implements CandidateSource {
  readonly name = 'devto';
  readonly enabledByDefault = true;

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const authors = new Map<string, { u: any; tags: Set<string>; reactions: number; last: string }>();
    for (const skill of p.skills.slice(0, 3)) {
      const tag = skill.replace(/[ ./]/g, '').replace(/\+/g, 'plus').replace(/#/g, 'sharp');
      const arts: any[] = await getJson('https://dev.to/api/articles', { tag, top: 365, per_page: 30 });
      for (const a of arts) {
        const u = a.user ?? {};
        if (!u.username) continue;
        const e = authors.get(u.username) ?? { u, tags: new Set<string>(), reactions: 0, last: '' };
        (a.tag_list ?? []).forEach((t: string) => e.tags.add(t));
        e.reactions += a.positive_reactions_count ?? 0;
        const pub = (a.published_at ?? '').slice(0, 10);
        if (pub > e.last) e.last = pub;
        authors.set(u.username, e);
      }
    }
    return [...authors.entries()].sort((a, b) => b[1].reactions - a[1].reactions).slice(0, limit).map(([name, e]) => {
      const urls = [`https://dev.to/${name}`];
      if (e.u.github_username) urls.push(`https://github.com/${e.u.github_username}`);
      const c = makeCandidate({ name: e.u.name || name, handle: name, source: this.name, profileUrls: urls, skills: [...e.tags].sort(), lastActive: e.last || null });
      c.signals.reactions = e.reactions;
      return c;
    });
  }
}
