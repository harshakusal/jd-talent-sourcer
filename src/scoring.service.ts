import { Injectable } from '@nestjs/common';
import { Candidate, JobProfile, candidateText } from './models';
import { findSkills, normalize } from './taxonomy';

export const WEIGHTS = { skills: 50, seniority: 15, location: 15, activity: 10, source_signals: 10 } as const;
const LEVEL: Record<string, number> = { junior: 1, mid: 2, senior: 3, lead: 4, staff: 4, principal: 5 };
const ALIAS: Record<string, string> = { bangalore: 'bengaluru', bengaluru: 'bangalore', gurgaon: 'gurugram', bombay: 'mumbai' };

export function candidateSkills(c: Candidate): Set<string> {
  const s = new Set(findSkills(candidateText(c)));
  for (const raw of c.skills) { const n = normalize(raw) ?? raw?.toLowerCase(); if (n) s.add(n); }
  return s;
}

function skillsPart(p: JobProfile, c: Candidate): [number, string[]] {
  if (!p.skills.length) return [0, []];
  const have = candidateSkills(c);
  const matched = p.skills.filter((s) => have.has(s));
  const must = new Set(p.mustHave.length ? p.mustHave : p.skills);
  const w = (s: string) => (must.has(s) ? 2 : 1);
  return [matched.reduce((a, s) => a + w(s), 0) / p.skills.reduce((a, s) => a + w(s), 0), matched];
}

function seniorityPart(p: JobProfile, c: Candidate): number {
  const target = LEVEL[p.seniority] ?? 2;
  const t = candidateText(c);
  let est = 0;
  const ys = [...t.matchAll(/(\d{1,2})\+?\s*(?:years|yrs|yoe)/g)].map((m) => +m[1]);
  if (ys.length) { const y = Math.max(...ys); est = y < 2 ? 1 : y < 5 ? 2 : y < 9 ? 3 : 4; }
  else if (/\b(principal|staff|architect|cto|head of)\b/.test(t)) est = 4;
  else if (/\b(senior|sr\.?|lead)\b/.test(t)) est = 3;
  else {
    const yrs = c.signals.account_years ?? 0, rep = c.signals.reputation ?? 0;
    est = yrs >= 10 || rep >= 50000 ? 4 : yrs >= 6 || rep >= 10000 ? 3 : yrs >= 3 || rep >= 1000 ? 2 : 0;
  }
  if (!est) return 0.5;
  return Math.max(0, 1 - Math.abs(est - target) * 0.3);
}

function locationPart(p: JobProfile, c: Candidate): number {
  if (!p.location || p.location.toLowerCase() === 'remote') return p.remote || !p.location ? 1 : 0.5;
  const want = p.location.split(/[,/]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  const loc = (c.location || '').toLowerCase();
  if (!loc) return 0.4;
  if (want.some((w) => loc.includes(w) || (ALIAS[w] && loc.includes(ALIAS[w])))) return 1;
  if (p.remote && loc.includes('remote')) return 0.8;
  return p.remote ? 0.5 : 0.2;
}

function activityPart(c: Candidate): number {
  if (!c.lastActive) return 0.4;
  const d = Date.parse(c.lastActive.slice(0, 10));
  if (isNaN(d)) return 0.4;
  const days = (Date.now() - d) / 864e5;
  return days <= 30 ? 1 : days <= 90 ? 0.8 : days <= 365 ? 0.6 : days <= 730 ? 0.3 : 0.1;
}

function signalsPart(c: Candidate): number {
  const lg = (v: number, cap: number) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + cap));
  const caps: Record<string, number> = { stars: 5000, followers: 5000, reputation: 200000, reactions: 2000 };
  const vals = Object.entries(caps).filter(([k]) => k in c.signals).map(([k, cap]) => lg(c.signals[k], cap));
  return vals.length ? vals.reduce((a, b) => a + b) / vals.length : 0.3;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

@Injectable()
export class ScoringService {
  score(p: JobProfile, c: Candidate): Candidate {
    const [sk, matched] = skillsPart(p, c);
    const parts = { skills: sk, seniority: seniorityPart(p, c), location: locationPart(p, c), activity: activityPart(c), source_signals: signalsPart(c) };
    c.matchedSkills = matched;
    c.breakdown = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, r1(v * WEIGHTS[k as keyof typeof WEIGHTS])]));
    c.score = r1(Object.values(c.breakdown).reduce((a, b) => a + b, 0));
    return c;
  }
}
