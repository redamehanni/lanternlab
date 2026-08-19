/**
 * Politiques d'occurrence (once / daily / miss).
 */

const { OCCURRENCE_KINDS, MISS_POLICIES } = require('./types');
const time = require('./time');

function getLedger(runtime, ruleId) {
  if (!runtime.occurrenceLedger) runtime.occurrenceLedger = {};
  if (!runtime.occurrenceLedger[ruleId]) {
    runtime.occurrenceLedger[ruleId] = {
      fireCount: 0,
      lastFiredAt: null,
      missedAt: [],
      exhausted: false,
      nextDueAt: null,
    };
  }
  return runtime.occurrenceLedger[ruleId];
}

/**
 * La Rule est-elle encore éligible à s'exécuter ?
 */
function isEligible(rule, runtime, ctx) {
  const occ = rule.occurrence || { kind: OCCURRENCE_KINDS.ALWAYS };
  const led = getLedger(runtime, rule.id);

  if (led.exhausted) return false;
  if (occ.maxFires != null && led.fireCount >= occ.maxFires) return false;

  switch (occ.kind) {
    case OCCURRENCE_KINDS.ALWAYS:
      return true;
    case OCCURRENCE_KINDS.ONCE_PER_RUN:
    case OCCURRENCE_KINDS.ONCE_PER_PLAYER:
    case OCCURRENCE_KINDS.ONCE_PER_TEAM:
      return led.fireCount === 0 && !led.exhausted;
    case OCCURRENCE_KINDS.ONCE_PER_OCCURRENCE: {
      // Une fois par clé d'occurrence (ex. jour calendaire)
      const key = occurrenceKey(occ, ctx);
      return !led.keysFired?.includes(key);
    }
    case OCCURRENCE_KINDS.DAILY: {
      const key = occurrenceKey({ ...occ, kind: OCCURRENCE_KINDS.DAILY }, ctx);
      return !led.keysFired?.includes(key);
    }
    default:
      return true;
  }
}

function occurrenceKey(occ, ctx) {
  const tz = occ.schedule?.timezone || ctx.definition.timezone || 'Europe/Paris';
  const p = time.getLocalParts(ctx.now, tz);
  if (occ.kind === OCCURRENCE_KINDS.DAILY || occ.kind === OCCURRENCE_KINDS.ONCE_PER_OCCURRENCE) {
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
  return 'default';
}

function markFired(rule, runtime, ctx) {
  const occ = rule.occurrence || { kind: OCCURRENCE_KINDS.ALWAYS };
  const led = getLedger(runtime, rule.id);
  led.fireCount += 1;
  led.lastFiredAt = time.toDate(ctx.now).toISOString();

  if (
    occ.kind === OCCURRENCE_KINDS.ONCE_PER_RUN ||
    occ.kind === OCCURRENCE_KINDS.ONCE_PER_PLAYER ||
    occ.kind === OCCURRENCE_KINDS.ONCE_PER_TEAM
  ) {
    led.exhausted = true;
  }

  if (occ.kind === OCCURRENCE_KINDS.ONCE_PER_OCCURRENCE || occ.kind === OCCURRENCE_KINDS.DAILY) {
    if (!led.keysFired) led.keysFired = [];
    led.keysFired.push(occurrenceKey(occ, ctx));
  }

  if (occ.maxFires != null && led.fireCount >= occ.maxFires) {
    led.exhausted = true;
  }
}

/**
 * Marque une occurrence manquée (ex. time.schedule hors conditions).
 */
function markMissed(rule, runtime, ctx, reason = 'conditions_unmet') {
  const occ = rule.occurrence || {};
  const led = getLedger(runtime, rule.id);
  const at = time.toDate(ctx.now).toISOString();
  led.missedAt.push({ at, reason });

  const miss = occ.missPolicy || occ.schedule?.missPolicy;
  if (miss === MISS_POLICIES.EXPIRE) {
    led.exhausted = true;
  }
  // skip_wait_next : ne pas exhaust, juste enregistrer le miss
  return { missed: true, exhausted: led.exhausted, missPolicy: miss || null };
}

module.exports = {
  getLedger,
  isEligible,
  markFired,
  markMissed,
  occurrenceKey,
};
