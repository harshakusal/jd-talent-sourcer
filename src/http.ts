export class SourceError extends Error {}
export const UA = 'jd-talent-sourcer/1.0 (+https://github.com/harshakusal/jd-talent-sourcer)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with timeout, brief rate-limit backoff (429 / 403 rate-limit) and readable errors. */
export async function fetchRaw(url: string, opts: { params?: Record<string, any>; headers?: Record<string, string>; retries?: number; timeoutMs?: number; init?: RequestInit } = {}): Promise<Response> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(opts.params ?? {})) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  const retries = opts.retries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let r: Response;
    try {
      r = await fetch(u, { ...opts.init, headers: { ...(typeof window === 'undefined' ? { 'User-Agent': UA } : {}), ...(opts.headers ?? {}) }, signal: AbortSignal.timeout(opts.timeoutMs ?? 20000) });
    } catch (e: any) {
      if (attempt === retries) throw new SourceError(`network error: ${e.message}`);
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (r.status === 429 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(r.headers.get('retry-after') ?? r.headers.get('x-ratelimit-reset') ?? 0);
      let wait = reset > 1e9 ? reset - Date.now() / 1000 : reset || 2 * (attempt + 1);
      if (attempt === retries || wait > 30) throw new SourceError(`rate limited (${r.status}); retry after ~${Math.round(wait)}s`);
      await sleep(Math.max(1, wait) * 1000);
      continue;
    }
    if (r.status >= 400) throw new SourceError(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }
  throw new SourceError('exhausted retries');
}

export async function getJson<T = any>(url: string, params?: Record<string, any>, headers?: Record<string, string>): Promise<T> {
  return (await fetchRaw(url, { params, headers })).json() as Promise<T>;
}
