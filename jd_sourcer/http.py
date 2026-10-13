import logging, time
import requests

log = logging.getLogger("jd_sourcer")
UA = {"User-Agent": "jd-talent-sourcer/0.1 (+https://github.com/harshakusal/jd-talent-sourcer)"}


class SourceError(Exception):
    pass


def get_json(url, params=None, headers=None, retries=2, timeout=20):
    h = dict(UA, **(headers or {}))
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, params=params, headers=h, timeout=timeout)
        except requests.RequestException as e:
            if attempt == retries:
                raise SourceError(f"network error: {e}")
            time.sleep(1.5 * (attempt + 1))
            continue
        if r.status_code in (429, 403) and ("rate" in r.text.lower() or r.status_code == 429):
            reset = r.headers.get("Retry-After") or r.headers.get("X-RateLimit-Reset")
            wait = 2 * (attempt + 1)
            try:
                if reset:
                    v = int(reset)
                    wait = v - int(time.time()) if v > 1e9 else v
            except ValueError:
                pass
            if attempt == retries or wait > 30:
                raise SourceError(f"rate limited ({r.status_code}); retry after ~{wait}s")
            time.sleep(max(1, wait))
            continue
        if r.status_code >= 400:
            raise SourceError(f"HTTP {r.status_code}: {r.text[:200]}")
        return r.json()
    raise SourceError("exhausted retries")
