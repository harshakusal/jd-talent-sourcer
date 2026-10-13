import { Candidate, JobProfile } from '../models';

/** Every source provider implements this. Register new ones in sources.module.ts. */
export interface CandidateSource {
  readonly name: string;
  readonly enabledByDefault: boolean;
  search(profile: JobProfile, limit: number): Promise<Candidate[]>;
}
export const CANDIDATE_SOURCES = Symbol('CANDIDATE_SOURCES');
export const decodeHtml = (s: string) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/g, '/')
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
