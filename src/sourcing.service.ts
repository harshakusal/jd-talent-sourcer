import { Inject, Injectable, Logger } from '@nestjs/common';
import { ExtractService } from './extract.service';
import { Candidate, JobProfile } from './models';
import { ScoringService } from './scoring.service';
import { CANDIDATE_SOURCES, CandidateSource } from './sources/source';

export interface SourceRequest { jd: string; sources?: string[]; limit?: number; useLlm?: boolean }
export interface SourceResult { job: JobProfile; sources: Record<string, string>; count: number; candidates: Candidate[] }

const KEY_RE = /^https?:\/\/(?:[a-z]{2,3}\.)?(github\.com|gitlab\.com|linkedin\.com\/in|dev\.to)\/([^/?#]+)/i;

/** Merge candidates sharing a canonical GitHub/GitLab/LinkedIn/Dev.to URL (or same source+handle). */
export function dedupe(cands: Candidate[]): Candidate[] {
  const merged: Candidate[] = [];
  const index = new Map<string, Candidate>();
  for (const c of cands) {
    const keys = new Set<string>([`${c.source}:${c.handle.toLowerCase()}`]);
    for (const u of c.profileUrls) { const m = KEY_RE.exec(u ?? ''); if (m) keys.add(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`); }
    let hit = [...keys].map((k) => index.get(k)).find(Boolean);
    if (!hit) { merged.push(c); hit = c; }
    else {
      for (const u of c.profileUrls) if (u && !hit.profileUrls.includes(u)) hit.profileUrls.push(u);
      hit.sources = [...new Set([...hit.sources, ...c.sources])].sort();
      hit.skills = [...new Set([...hit.skills, ...c.skills])];
      hit.bio = `${hit.bio} ${c.bio}`.trim();
      hit.location ||= c.location;
      hit.lastActive = [hit.lastActive, c.lastActive].filter(Boolean).sort().pop() ?? null;
      for (const [k, v] of Object.entries(c.signals)) hit.signals[k] = Math.max(v, hit.signals[k] ?? 0);
    }
    for (const k of keys) index.set(k, hit);
  }
  return merged;
}

@Injectable()
export class SourcingService {
  private log = new Logger('Sourcing');
  constructor(
    private readonly extractor: ExtractService,
    private readonly scorer: ScoringService,
    @Inject(CANDIDATE_SOURCES) private readonly all: CandidateSource[],
  ) {}

  listSources() {
    return this.all.map((s) => ({ name: s.name, enabledByDefault: s.enabledByDefault }));
  }

  async run(req: SourceRequest): Promise<SourceResult> {
    const job = await this.extractor.extract(req.jd, req.useLlm !== false);
    const limit = Math.min(Math.max(req.limit ?? 20, 1), 50);
    const wanted = req.sources?.length ? this.all.filter((s) => req.sources!.includes(s.name)) : this.all.filter((s) => s.enabledByDefault);
    const status: Record<string, string> = {};
    const settled = await Promise.allSettled(wanted.map((s) => s.search(job, limit)));
    const cands: Candidate[] = [];
    settled.forEach((r, i) => {
      const n = wanted[i].name;
      if (r.status === 'fulfilled') { status[n] = `ok (${r.value.length})`; cands.push(...r.value); }
      else { // per-source failure never fails the request
        const msg = String(r.reason?.message ?? r.reason).slice(0, 200);
        this.log.warn(`source ${n} failed: ${msg}`);
        status[n] = `error: ${msg}`;
      }
    });
    const ranked = dedupe(cands).map((c) => this.scorer.score(job, c)).sort((a, b) => b.score - a.score);
    return { job, sources: status, count: ranked.length, candidates: ranked };
  }
}
