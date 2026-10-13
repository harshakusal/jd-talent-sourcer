import { Injectable } from '@nestjs/common';
import { getJson } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { CandidateSource } from './source';

/** [For Hire] posts on r/forhire (public JSON). Off by default; request it with sources: ["reddit"]. */
@Injectable()
export class RedditSource implements CandidateSource {
  readonly name = 'reddit';
  readonly enabledByDefault = false;

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const q = 'flair:"For Hire" ' + p.skills.slice(0, 3).join(' OR ');
    const d = await getJson('https://www.reddit.com/r/forhire/search.json', { q, restrict_sr: 1, sort: 'new', limit });
    return (d.data?.children ?? []).map((ch: any) => ch.data)
      .filter((x: any) => `${x.title}${x.link_flair_text ?? ''}`.toLowerCase().includes('for hire'))
      .map((x: any) => makeCandidate({
        name: x.author, handle: x.author, source: this.name,
        profileUrls: [`https://www.reddit.com/user/${x.author}`, `https://www.reddit.com${x.permalink}`],
        bio: `${x.title} ${(x.selftext ?? '').slice(0, 1500)}`, lastActive: new Date(x.created_utc * 1000).toISOString().slice(0, 10),
      }));
  }
}
