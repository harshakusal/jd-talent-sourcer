import { Injectable } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { CandidateSource, decodeHtml } from './source';

const ALG = 'https://hn.algolia.com/api/v1';

/** Comments from the latest monthly "Ask HN: Who wants to be hired?" threads (Algolia HN API). */
@Injectable()
export class HackerNewsSource implements CandidateSource {
  readonly name = 'hackernews';
  readonly enabledByDefault = true;

  async search(p: JobProfile, limit = 20, months = 2): Promise<Candidate[]> {
    const d = await getJson(`${ALG}/search_by_date`, { query: '"Who wants to be hired"', tags: 'story,author_whoishiring', hitsPerPage: months });
    const q = p.skills.slice(0, 2).join(' ');
    const out: Candidate[] = [];
    for (const story of (d.hits ?? []).slice(0, months)) {
      const hits = (await getJson(`${ALG}/search`, { tags: `comment,story_${story.objectID}`, query: q, hitsPerPage: limit * 2, advancedSyntax: 'true', optionalWords: q })).hits ?? [];
      for (const h of hits) {
        const txt = decodeHtml((h.comment_text ?? '').replace(/<p>/g, '\n'));
        if (!/location/i.test(txt)) continue;
        const loc = /location\s*:\s*([^\n]+?)(?:\s{2,}|remote\s*:|willing|\n|$)/i.exec(txt);
        const urls = txt.match(/https?:\/\/[^\s<>"]+/g) ?? [];
        out.push(makeCandidate({
          name: h.author, handle: h.author, source: this.name,
          profileUrls: [`https://news.ycombinator.com/item?id=${h.objectID}`, ...urls.slice(0, 3)],
          location: loc ? loc[1].trim().slice(0, 80) : '', bio: txt.slice(0, 1500), lastActive: (h.created_at ?? '').slice(0, 10),
        }));
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
}
