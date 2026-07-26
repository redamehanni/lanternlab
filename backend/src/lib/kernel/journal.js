/**
 * Noyau — journal append-only générique.
 *
 * LOI 9 — CE QUI N'EST PAS JOURNALISÉ N'EST PAS ARRIVÉ.
 * Toute décision d'organe s'écrit dans un journal, DANS LA MÊME TRANSACTION que la
 * décision. Un journal écrit après coup peut manquer précisément les cas qui
 * comptent : ceux où quelque chose a échoué.
 *
 * Une table par organe, sur le modèle de `event_journal` et
 * `digital_object_events` qui existent déjà. On ne migre PAS ces journaux
 * existants : ils fonctionnent, et une unification forcée coûterait plus que la
 * duplication qu'elle supprime.
 *
 * Le journal ÉCRIT et RELIT. Il n'interprète jamais le contenu : `payload` est un
 * blob opaque pour lui, et c'est l'organe propriétaire qui sait le lire.
 */

const db = require('../../db');

const registered = new Map(); // nom logique -> définition

/**
 * Déclare un journal et crée sa table si besoin.
 *
 * @param {object} definition
 * @param {string} definition.name       nom logique (`orders`)
 * @param {string} definition.table      table SQLite (`order_journal`)
 * @param {string} definition.subjectColumn colonne d'entité (`order_id`)
 * @param {string} [definition.subjectReferences] table référencée (`orders(id)`)
 */
function defineJournal({ name, table, subjectColumn, subjectReferences = null }) {
  if (!name || !table || !subjectColumn) {
    throw new Error('[journal] name, table et subjectColumn sont obligatoires');
  }
  if (registered.has(name) && registered.get(name).table !== table) {
    throw new Error(`[journal] « ${name} » est déjà déclaré sur une autre table`);
  }

  const reference = subjectReferences ? ` REFERENCES ${subjectReferences}` : '';

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY,
      ${subjectColumn} TEXT NOT NULL${reference},
      type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor TEXT,
      payload TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_${table}_subject
      ON ${table}(${subjectColumn}, created_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_idempotency
      ON ${table}(${subjectColumn}, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);

  const journal = {
    name,
    table,
    subjectColumn,

    /**
     * Écrit une entrée. À appeler DANS la transaction de la décision.
     *
     * @returns {string} identifiant de l'entrée
     */
    append(subjectId, { type, fromStatus = null, toStatus = null, actor = null, payload = null, idempotencyKey = null }) {
      if (!subjectId) throw new Error(`[journal:${name}] identifiant de sujet manquant`);
      if (!type) throw new Error(`[journal:${name}] type manquant`);

      const id = db.generateId();
      db.prepare(`
        INSERT INTO ${table}
          (id, ${subjectColumn}, type, from_status, to_status, actor, payload, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        subjectId,
        type,
        fromStatus,
        toStatus,
        actor,
        payload === null ? null : JSON.stringify(payload),
        idempotencyKey
      );
      return id;
    },

    /** Historique complet d'un sujet, dans l'ordre. */
    read(subjectId) {
      const rows = db
        .prepare(`SELECT * FROM ${table} WHERE ${subjectColumn} = ? ORDER BY created_at ASC, rowid ASC`)
        .all(subjectId);
      return rows.map(parseRow);
    },

    /** Dernière entrée d'un type donné, ou `null`. */
    lastOfType(subjectId, type) {
      const row = db
        .prepare(`
          SELECT * FROM ${table}
          WHERE ${subjectColumn} = ? AND type = ?
          ORDER BY created_at DESC, rowid DESC LIMIT 1
        `)
        .get(subjectId, type);
      return row ? parseRow(row) : null;
    },

    /** Le sujet porte-t-il déjà une entrée de ce type ? */
    has(subjectId, type) {
      const row = db
        .prepare(`SELECT 1 AS ok FROM ${table} WHERE ${subjectColumn} = ? AND type = ? LIMIT 1`)
        .get(subjectId, type);
      return !!row;
    },
  };

  registered.set(name, journal);
  return journal;
}

function parseRow(row) {
  let payload = null;
  if (row.payload !== null && row.payload !== undefined) {
    try {
      payload = JSON.parse(row.payload);
    } catch {
      // Le journal ne réécrit jamais l'histoire : une charge illisible est
      // retournée telle quelle plutôt que remplacée par null.
      payload = row.payload;
    }
  }
  return { ...row, payload };
}

/** Journal déjà déclaré, ou `null`. */
function get(name) {
  return registered.get(name) || null;
}

module.exports = { defineJournal, get };
