/**
 * Orchestration — journal des exécutions d'intention (Loi 9).
 *
 * Table dédiée plutôt que le journal générique du noyau : une exécution a un ÉTAPE
 * et un STATUT d'étape comme colonnes de premier plan. C'est ce qui permet de
 * répondre en une requête à « quelles intentions se sont arrêtées au milieu », la
 * seule question qui compte quand un processus s'interrompt.
 *
 * L'exécution étant en process, un crash au milieu d'une intention laisse un plan
 * partiellement exécuté. Ce journal est le moyen de le VOIR et de reprendre à la
 * main. Une file durable arrivera quand le volume l'exigera, pas avant.
 */

const db = require('../../db');

db.exec(`
  CREATE TABLE IF NOT EXISTS orchestration_journal (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    step TEXT,
    status TEXT NOT NULL,
    actor TEXT,
    actor_role TEXT,
    result TEXT,
    error TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_orchestration_run
    ON orchestration_journal(run_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_orchestration_intent
    ON orchestration_journal(intent_id, created_at);
`);

/** Statuts d'une entrée. `pending` n'existe pas : on n'écrit que ce qui est arrivé. */
const RUN_STATUS = {
  STARTED: 'started',
  STEP_DONE: 'step_done',
  STEP_FAILED: 'step_failed',
  STEP_SKIPPED: 'step_skipped',
  COMPENSATED: 'compensated',
  COMPENSATION_FAILED: 'compensation_failed',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REPLAYED: 'replayed',
};

function append({
  runId, intentId, step = null, status, actor = null, actorRole = null,
  result = null, error = null, idempotencyKey = null,
}) {
  const id = db.generateId();
  db.prepare(`
    INSERT INTO orchestration_journal
      (id, run_id, intent_id, step, status, actor, actor_role, result, error, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, runId, intentId, step, status, actor, actorRole,
    result === null ? null : JSON.stringify(summarize(result)),
    error,
    idempotencyKey
  );
  return id;
}

/**
 * Le journal garde une TRACE, pas une copie.
 *
 * Écrire le résultat complet de chaque étape ferait grossir la table au rythme des
 * commandes et y recopierait des données personnelles qui vivent déjà dans les
 * tables d'organe. On conserve les identifiants et les compteurs, c'est-à-dire ce qui
 * permet de retrouver, pas de reconstituer.
 */
function summarize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return { count: value.length };

  const kept = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'number' || typeof item === 'boolean' || typeof item === 'string') {
      kept[key] = item;
    } else if (typeof item === 'object' && item.id) {
      kept[key] = { id: item.id, ...(item.status ? { status: item.status } : {}) };
    } else if (Array.isArray(item)) {
      kept[key] = { count: item.length };
    }
  }
  return kept;
}

/** Histoire complète d'une exécution, dans l'ordre. */
function read(runId) {
  return db
    .prepare('SELECT * FROM orchestration_journal WHERE run_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(runId)
    .map(parse);
}

/**
 * Exécutions restées en plan : démarrées, ni terminées ni échouées proprement.
 *
 * C'est la requête de reprise après incident, et la raison d'être de ce journal.
 */
function findIncomplete({ limit = 50 } = {}) {
  return db.prepare(`
    SELECT run_id, intent_id, MIN(created_at) AS started_at
    FROM orchestration_journal
    GROUP BY run_id
    HAVING SUM(status IN ('completed', 'failed', 'replayed')) = 0
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit);
}

function parse(row) {
  let result = null;
  if (row.result) {
    try {
      result = JSON.parse(row.result);
    } catch {
      result = row.result;
    }
  }
  return { ...row, result };
}

module.exports = { append, read, findIncomplete, RUN_STATUS };
