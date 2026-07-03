import { API_URL } from '../config';

export const DRIVER_COMMISSION_RATE = 0.05; // 5 % (issue #6)

export function euro(n) {
  if (n == null || isNaN(n)) return '—';
  return `${Number(n).toFixed(2)} €`;
}

export function commissionFor(price) {
  if (price == null) return 0;
  return Math.round(price * DRIVER_COMMISSION_RATE * 100) / 100;
}

// minutes → "25 min" / "1h05"
export function formatMinutes(min) {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// Construit l'URL absolue d'une image servie par le backend
export function imageUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${API_URL}${pathOrUrl}`;
}
