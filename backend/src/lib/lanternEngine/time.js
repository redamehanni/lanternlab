/**
 * Helpers temps pour predicates / fenêtres (timezone IANA via Intl).
 */

function toDate(now) {
  if (now instanceof Date) return now;
  if (typeof now === 'number') return new Date(now);
  if (typeof now === 'string') return new Date(now);
  throw new Error('EvalContext.now invalide');
}

/**
 * Retourne { year, month, day, hour, minute, second, weekday } en timezone.
 * weekday : 0=dimanche … 6=samedi (comme Date.getDay).
 */
function getLocalParts(now, timezone = 'Europe/Paris') {
  const d = toDate(now);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

/** "HH:mm" ou "HH:mm:ss" → minutes depuis minuit */
function parseHmToMinutes(hm) {
  if (typeof hm !== 'string') throw new Error(`heure invalide: ${hm}`);
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hm.trim());
  if (!m) throw new Error(`heure invalide: ${hm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`heure invalide: ${hm}`);
  return h * 60 + min;
}

function localMinutes(now, timezone) {
  const p = getLocalParts(now, timezone);
  return p.hour * 60 + p.minute;
}

/**
 * Fenêtre inclusive [start, end] en HH:mm locale.
 * Si end < start → fenêtre qui traverse minuit.
 */
function isInTimeWindow(now, startHm, endHm, timezone = 'Europe/Paris') {
  const cur = localMinutes(now, timezone);
  const start = parseHmToMinutes(startHm);
  const end = parseHmToMinutes(endHm);
  if (end < start) return cur >= start || cur <= end;
  return cur >= start && cur <= end;
}

function equalsMinute(now, hm, timezone = 'Europe/Paris') {
  return localMinutes(now, timezone) === parseHmToMinutes(hm);
}

module.exports = {
  toDate,
  getLocalParts,
  parseHmToMinutes,
  localMinutes,
  isInTimeWindow,
  equalsMinute,
};
