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

export async function resolveLabSession(token, apiUrl) {
  if (!token) return null;
  const res = await fetch(`${apiUrl}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.user) return null;
  return { token, user: data.user };
}
