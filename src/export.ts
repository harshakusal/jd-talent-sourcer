import { Candidate } from './models';

export const CSV_FIELDS = ['score', 'name', 'handle', 'sources', 'location', 'matched_skills', 'profile_urls', 'breakdown'];
const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function toRow(c: Candidate) {
  return {
    score: c.score, name: c.name, handle: c.handle, sources: c.sources.join(';'), location: c.location,
    matched_skills: c.matchedSkills.join(';'), profile_urls: c.profileUrls.join(' '),
    breakdown: Object.entries(c.breakdown).map(([k, v]) => `${k}=${v}`).join('; '),
  };
}

export function toCsv(cands: Candidate[]): string {
  const rows = cands.map(toRow).map((r) => CSV_FIELDS.map((f) => cell((r as any)[f])).join(','));
  return [CSV_FIELDS.join(','), ...rows].join('\r\n') + '\r\n';
}
