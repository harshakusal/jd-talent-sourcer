export interface JobProfile {
  title: string;
  seniority: string;
  skills: string[];
  mustHave: string[];
  location: string;
  remote: boolean;
  minYears: number | null;
}

export interface Candidate {
  name: string;
  handle: string;
  source: string;
  sources: string[];
  profileUrls: string[];
  location: string;
  bio: string;
  skills: string[];
  lastActive: string | null;
  signals: Record<string, number>;
  matchedSkills: string[];
  score: number;
  breakdown: Record<string, number>;
}

export function makeCandidate(p: Partial<Candidate> & { name: string; handle: string; source: string }): Candidate {
  return {
    sources: [p.source], profileUrls: [], location: '', bio: '', skills: [], lastActive: null,
    signals: {}, matchedSkills: [], score: 0, breakdown: {}, ...p,
  };
}

export const candidateText = (c: Candidate) => `${c.bio || ''} ${c.skills.join(' ')}`.toLowerCase();
