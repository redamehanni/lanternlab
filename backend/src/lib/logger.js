/**
 * Journal applicatif — sortie structurée, zéro dépendance.
 *
 * Étape 0 de la roadmap : « logs structurés ». En production, une ligne = un
 * objet JSON, directement exploitable par un agrégateur. Hors production, une
 * ligne lisible à l'œil.
 *
 * Ce module n'est PAS le journal métier append-only (Loi 9) : celui-là vit en
 * base, par organe (`event_journal`, `order_journal`…). Ici on parle uniquement
 * d'observabilité technique.
 */

const config = require('../config/env');

const LEVELS = { error: 50, warn: 40, info: 30, debug: 20 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

// Clés dont la valeur ne doit jamais atteindre les logs.
const REDACTED_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'idempotencyKey',
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redact(val, depth + 1);
  }
  return out;
}

function emit(level, message, context) {
  if (LEVELS[level] < threshold) return;

  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const safeContext = context ? redact(context) : undefined;

  if (config.isProduction) {
    stream.write(
      `${JSON.stringify({
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...(safeContext ? { ctx: safeContext } : {}),
      })}\n`
    );
    return;
  }

  const suffix = safeContext ? ` ${JSON.stringify(safeContext)}` : '';
  stream.write(`[${level}] ${message}${suffix}\n`);
}

/**
 * Erreur inattendue. Le DSN d'error tracking est un point d'accroche : aucune
 * dépendance n'est imposée tant qu'un outil n'a pas été choisi.
 */
function reportError(message, error, context) {
  emit('error', message, {
    ...context,
    error: error?.message,
    stack: config.isProduction ? undefined : error?.stack,
  });
}

module.exports = {
  error: (message, context) => emit('error', message, context),
  warn: (message, context) => emit('warn', message, context),
  info: (message, context) => emit('info', message, context),
  debug: (message, context) => emit('debug', message, context),
  reportError,
};
