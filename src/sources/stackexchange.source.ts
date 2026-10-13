import { Injectable } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { soTag } from '../taxonomy';
import { CandidateSource, decodeHtml } from './source';

const API = 'https://api.stackexchange.com/2.3';

@Injectable()
export class StackExchangeSource implements CandidateSource {
  readonly name = 'stackexchange';
  readonly enabledByDefault = true;

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const base: Record<string, string> = { site: 'stackoverflow' };
    if (process.env.STACKEXCHANGE_KEY) base.key = process.env.STACKEXCHANGE_KEY;
    const users = new Map<number, { tags: Set<string>; score: number }>();
    const errors: string[] = [];
    for (const skill of p.skills.slice(0, 3)) {
      try {
        const d = await getJson(`${API}/tags/${encodeURIComponent(soTag(skill))}/top-answerers/all_time`, { ...base, pagesize: limit });
        for (const it of d.items ?? []) {
          const id = it.user?.user_id;
          if (!id) continue;
          const e = users.get(id) ?? { tags: new Set<string>(), score: 0 };
          e.tags.add(skill); e.score += it.score ?? 0; users.set(id, e);
        }
      } catch (e: any) { errors.push(e.message); }
    }
    if (!users.size) { if (errors.length) throw new Error(errors.join('; ')); return []; }
    const ids = [...users.keys()].sort((a, b) => users.get(b)!.score - users.get(a)!.score).slice(0, Math.min(100, limit * 2));
    const detail = (await getJson(`${API}/users/${ids.join(';')}`, { ...base, pagesize: 100 })).items ?? [];
    return detail.map((u: any) => {
      const e = users.get(u.user_id)!;
      const c = makeCandidate({
        name: decodeHtml(u.display_name ?? ''), handle: String(u.user_id), source: this.name,
        profileUrls: [u.link, u.website_url].filter(Boolean), location: decodeHtml(u.location ?? ''),
        skills: [...e.tags].sort(), lastActive: u.last_access_date ? new Date(u.last_access_date * 1000).toISOString().slice(0, 10) : null,
      });
      c.signals.reputation = u.reputation ?? 0;
      c.signals.tag_score = e.score;
      return c;
    });
  }
}
