import { readFileSync } from 'fs';
import { heuristicExtract } from '../src/extract.service';
import { makeCandidate } from '../src/models';
import { ScoringService } from '../src/scoring.service';
import { dedupe } from '../src/sourcing.service';
import { toCsv } from '../src/export';
import { parseDdgHtml } from '../src/sources/xray.source';

const JD = readFileSync(__dirname + '/../samples/sample_jd.txt', 'utf8');

describe('extract', () => {
  it('parses role, seniority, location and skills', () => {
    const p = heuristicExtract(JD);
    expect(p.skills).toEqual(expect.arrayContaining(['python', 'django', 'kubernetes', 'aws']));
    expect(p.seniority).toBe('senior');
    expect(p.location).toContain('Bangalore');
    expect(p.mustHave).toContain('python');
    expect(p.mustHave).not.toContain('kafka');
    expect(p.title.toLowerCase()).toContain('engineer');
  });
});

describe('scoring', () => {
  const p = heuristicExtract(JD);
  const s = new ScoringService();
  it('is bounded, ordered and has a breakdown that sums to the score', () => {
    const good = s.score(p, makeCandidate({ name: 'A', handle: 'a', source: 'github', location: 'Bengaluru, India',
      bio: 'Senior engineer, 8 years Python Django Postgres AWS Kubernetes Docker', lastActive: new Date().toISOString().slice(0, 10),
      signals: { stars: 500, followers: 300 } }));
    const bad = s.score(p, makeCandidate({ name: 'B', handle: 'b', source: 'github', location: 'Paris', bio: 'PHP dev' }));
    expect(bad.score).toBeGreaterThanOrEqual(0);
    expect(good.score).toBeLessThanOrEqual(100);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(Object.keys(good.breakdown).sort()).toEqual(['activity', 'location', 'seniority', 'skills', 'source_signals']);
    expect(Math.abs(Object.values(good.breakdown).reduce((a, b) => a + b, 0) - good.score)).toBeLessThan(0.2);
  });
});

describe('dedupe + export', () => {
  it('merges by canonical GitHub URL', () => {
    const m = dedupe([
      makeCandidate({ name: 'x', handle: 'octo', source: 'github', profileUrls: ['https://github.com/Octo'] }),
      makeCandidate({ name: 'x', handle: 'octo_dev', source: 'devto', profileUrls: ['https://dev.to/octo_dev', 'https://github.com/octo'] }),
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].sources.sort()).toEqual(['devto', 'github']);
  });
  it('writes escaped CSV', () => {
    const csv = toCsv([makeCandidate({ name: 'Doe, "J"', handle: 'j', source: 'github' })]);
    expect(csv.split('\r\n')[0]).toBe('score,name,handle,sources,location,matched_skills,profile_urls,breakdown');
    expect(csv).toContain('"Doe, ""J"""');
  });
  it('parses DuckDuckGo HTML results', () => {
    const html = '<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fjane&rut=x">Jane - Python Dev</a><a class="result__snippet" href="#">Bangalore</a>';
    expect(parseDdgHtml(html)[0]).toEqual({ url: 'https://www.linkedin.com/in/jane', title: 'Jane - Python Dev', snippet: 'Bangalore' });
  });
});
