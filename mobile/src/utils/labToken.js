/**
 * Extraction du jeton Laboratoire depuis une URL (web hash ou deep link natif).
 *
 * Formats supportés :
 *  - http://localhost:8081/#labToken=…
 *  - exp://192.168.x.x:8081/--/lab?labToken=…
 *  - mazone://lab?labToken=…
 */

export function extractLabTokenFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?#&]labToken=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function fetchMe(apiUrl, token, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Valide le jeton lab auprès de l'API.
 * Si l'URL primaire échoue (IP Wi‑Fi périmée), tente 127.0.0.1 en secours (simulateur).
 */
export async function resolveLabSession(token, apiUrl) {
  if (!token) return null;

  const candidates = [apiUrl];
  if (apiUrl && !/127\.0\.0\.1|localhost/.test(apiUrl)) {
    candidates.push('http://127.0.0.1:4000');
  }

  for (const base of candidates) {
    try {
      const res = await fetchMe(base, token);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.user) continue;
      if (base !== apiUrl) {
        console.warn(`[Lab] API primaire injoignable — session via ${base}`);
      }
      return { token, user: data.user, apiUrl: base };
    } catch (e) {
      console.warn(`[Lab] /me échoué sur ${base}`, e?.message || e);
    }
  }
  return null;
}
