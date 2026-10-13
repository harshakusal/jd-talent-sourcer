import { Injectable, Logger } from '@nestjs/common';
import { JobProfile } from './models';
import { findSkills } from './taxonomy';

const SENIORITY: [string, string[]][] = [
  ['principal', ['principal', 'distinguished', 'architect']], ['staff', ['staff']],
  ['lead', ['lead', 'head of', 'manager']], ['senior', ['senior', 'sr.', 'sr ']],
  ['junior', ['junior', 'jr.', 'entry level', 'graduate', 'intern']],
];
const TITLE_RE = /((?:senior|sr\.?|junior|jr\.?|lead|staff|principal)?\s*[\w+#./ -]{0,40}?(?:engineer|developer|scientist|architect|analyst|designer|manager|devops|sre))/i;
const LOC_RE = /(?:location|based in|located in|office in)\s*[:\-]?\s*([A-Z][\w .,'-]{1,60})/i;
const CITIES = ['bangalore', 'bengaluru', 'hyderabad', 'pune', 'mumbai', 'delhi', 'chennai', 'gurgaon', 'noida', 'london',
  'berlin', 'paris', 'amsterdam', 'new york', 'san francisco', 'seattle', 'austin', 'boston', 'toronto', 'singapore', 'sydney', 'dublin'];

export function heuristicExtract(jd: string): JobProfile {
  const low = jd.toLowerCase();
  const skills = findSkills(jd);
  const req = new Set(findSkills(low.split(/nice to have|bonus|preferred|plus:/)[0]));
  const must = skills.filter((s) => req.has(s));
  let title = '';
  const lines = jd.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);
  for (const line of [...lines, jd]) {
    const m = TITLE_RE.exec(line);
    if (m) { title = m[1].trim().replace(/^(title|role|position)\s*[:\-]\s*/i, '').replace(/^[\s:-]+|[\s:-]+$/g, ''); break; }
  }
  let seniority = 'mid';
  const scope = `${title} ${low.slice(0, 400)}`.toLowerCase();
  for (const [lvl, kws] of SENIORITY) if (kws.some((k) => scope.includes(k))) { seniority = lvl; break; }
  const years = [...low.matchAll(/(\d{1,2})\+?\s*(?:-\s*\d+\s*)?years/g)].map((m) => +m[1]);
  const minYears = years.length ? Math.min(...years) : null;
  if (minYears && seniority === 'mid') seniority = minYears >= 5 ? 'senior' : minYears <= 1 ? 'junior' : 'mid';
  let location = '';
  const lm = LOC_RE.exec(jd);
  if (lm) location = lm[1].split('\n')[0].trim().replace(/\.$/, '');
  else { const c = CITIES.find((c) => low.includes(c)); if (c) location = c.replace(/\b\w/g, (x) => x.toUpperCase()); }
  return { title, seniority, skills, mustHave: must.length ? must : skills.slice(0, 5), location, remote: low.includes('remote'), minYears };
}

@Injectable()
export class ExtractService {
  private log = new Logger('Extract');

  async extract(jd: string, useLlm = true): Promise<JobProfile> {
    const base = heuristicExtract(jd);
    const llm = useLlm ? await this.llm(jd) : null;
    if (!llm) return base;
    for (const s of base.skills) if (!llm.skills.includes(s)) llm.skills.push(s);
    llm.location ||= base.location;
    llm.title ||= base.title;
    return llm;
  }

  /** Optional: only used when OPENAI_API_KEY is set. Any failure falls back to heuristics. */
  private async llm(jd: string): Promise<JobProfile | null> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(60000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: 'Extract from this job description a JSON object with keys: title, seniority (junior|mid|senior|lead|staff|principal), skills (lowercase list), must_have (list), location (string or empty), remote (bool), min_years (int or null). JD:\n' + jd.slice(0, 8000) }],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = JSON.parse((await r.json()).choices[0].message.content);
      return {
        title: d.title || '', seniority: d.seniority || 'mid', skills: (d.skills || []).map((s: string) => s.toLowerCase()),
        mustHave: (d.must_have || []).map((s: string) => s.toLowerCase()), location: d.location || '', remote: !!d.remote, minYears: d.min_years ?? null,
      };
    } catch (e: any) {
      this.log.warn(`LLM extraction failed, using heuristics: ${e.message}`);
      return null;
    }
  }
}
