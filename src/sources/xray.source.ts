import { Injectable } from '@nestjs/common';
import { fetchRaw } from '../http';
import { Candidate, JobProfile, makeCandidate } from '../models';
import { CandidateSource, decodeHtml } from './source';

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * DuckDuckGo X-ray search via the HTML endpoint. Returns PUBLIC profile URLs + the search snippet only;
 * it never fetches or scrapes the profiles themselves.
 */
@Injectable()
export class XRaySource implements CandidateSource {
  readonly name = 'xray';
  readonly enabledByDefault = true;
  static SITES: Record<string, string> = { linkedin: 'site:linkedin.com/in', github: 'site:github.com' };

  async query(q: string): Promise<{ url: string; title: string; snippet: string }[]> {
    const r = await fetchRaw('https://html.duckduckgo.com/html/', {
      retries: 1, headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      init: { method: 'POST', body: new URLSearchParams({ q, kl: 'wt-wt' }).toString() },
    });
    return parseDdgHtml(await r.text());
  }

  async search(p: JobProfile, limit = 20): Promise<Candidate[]> {
    const sk = p.skills.slice(0, 2).join(' ');
    const loc = p.location && p.location.toLowerCase() !== 'remote' ? p.location.split(',')[0].trim() : '';
    const out: Candidate[] = [];
    const errors: string[] = [];
    for (const [site, op] of Object.entries(XRaySource.SITES)) {
      let results: Awaited<ReturnType<XRaySource['query']>> = [];
      for (const q of [`${op} ${sk} ${loc}`.trim(), `${op} ${sk}`]) {
        try { results = await this.query(q); } catch (e: any) { errors.push(`${site}: ${e.message}`); }
        if (results.length) break;
      }
      for (const r of results.slice(0, Math.max(5, Math.floor(limit / 2)))) {
        let url = r.url;
        if (site === 'linkedin' && !/linkedin\.com\/in\//.test(url)) continue;
        if (site === 'github' && !/^https:\/\/github\.com\/[^/]+\/?$/.test(url)) continue;
        const handle = url.replace(/\/$/, '').split('/').pop()!;
        if (site === 'linkedin') url = `https://www.linkedin.com/in/${handle}`;
        const name = r.title.split(/ [-|–·] |\.\.\./)[0].trim() || handle;
        out.push(makeCandidate({ name, handle, source: `xray:${site}`, profileUrls: [url], bio: `${r.title} ${r.snippet}` }));
      }
    }
    if (!out.length && errors.length) throw new Error(errors.join('; ').slice(0, 300));
    return out;
  }
}

export function parseDdgHtml(html: string) {
  const res: { url: string; title: string; snippet: string }[] = [];
  // each result block starts at a result__a link; the snippet (if any) follows before the next link
  const blocks = html.split(/(?=<a[^>]+class="result__a")/);
  for (const b of blocks) {
    const a = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    if (!a) continue;
    const sn = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/.exec(b);
    let url = decodeHtml(a[1]);
    const uddg = /[?&]uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    res.push({ url, title: decodeHtml(a[2]).replace(/\s+/g, ' ').trim(), snippet: decodeHtml(sn?.[1] ?? '').replace(/\s+/g, ' ').trim() });
  }
  return res;
}
