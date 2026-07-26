/**
 * Noyau — transactions, et garantie d'ordre commit → effets.
 *
 * LOI 7 — AUCUNE I/O RÉSEAU DANS UNE TRANSACTION.
 *
 * Ce module est le SEUL endroit du système autorisé à retenir des émissions. Il
 * corrige un défaut réel : `routes/orders.js` émettait des sockets à l'intérieur
 * d'un `db.transaction`. Conséquence, un client pouvait recevoir « commande
 * créée » pour une transaction qui allait ensuite échouer et être annulée.
 *
 * Usage :
 *
 *   const order = txn.run((ctx) => {
 *     const created = insertOrder(...);
 *     ctx.publish('order.created', { orderId: created.id });   // après commit
 *     ctx.after(() => io.emit('order:new', { order: created })); // après commit
 *     return created;
 *   });
 *
 * Si le corps lève, rien n'est écrit ET rien n'est émis. Si le corps réussit, la
 * transaction est validée puis les effets partent, dans l'ordre d'enregistrement.
 */

const db = require('../../db');
const bus = require('./bus');
const logger = require('../logger');

/** Profondeur d'imbrication : `run` imbriqué rejoint la transaction du parent. */
let depth = 0;
/** Effets collectés par la transaction racine. */
let pendingEffects = [];

/**
 * Le contexte passé au corps de la transaction. Volontairement minimal : deux
 * façons de différer un effet, et rien d'autre.
 */
function makeContext() {
  return {
    /** Publie un fait domaine sur le bus, après commit. */
    publish(channel, payload) {
      // Le nom est validé TOUT DE SUITE, pas au moment de l'émission : une faute
      // de frappe doit faire échouer la transaction, pas passer inaperçue une fois
      // les écritures validées.
      bus.assertValidChannel(channel);
      pendingEffects.push({ kind: 'fact', channel, payload });
    },

    /** Exécute un effet arbitraire (socket, notification) après commit. */
    after(effect) {
      if (typeof effect !== 'function') {
        throw new Error('[txn] after() attend une fonction');
      }
      pendingEffects.push({ kind: 'effect', effect });
    },
  };
}

function flushEffects(effects) {
  for (const item of effects) {
    try {
      if (item.kind === 'fact') bus.emit(item.channel, item.payload);
      else item.effect();
    } catch (err) {
      // Un effet en échec ne peut plus annuler la décision : elle est validée.
      // On le journalise pour ne pas perdre l'information.
      logger.reportError('Effet post-commit en échec', err, {
        kind: item.kind,
        channel: item.channel,
      });
    }
  }
}

/**
 * Exécute `body` dans une transaction SQLite, puis émet les effets différés.
 *
 * @template T
 * @param {(ctx: { publish: Function, after: Function }) => T} body
 * @returns {T}
 */
function run(body) {
  if (typeof body !== 'function') throw new Error('[txn] run() attend une fonction');

  // Imbrication : on rejoint la transaction en cours. SQLite n'a pas de vraies
  // transactions imbriquées, et un SAVEPOINT ici donnerait l'illusion d'un
  // rollback partiel que le reste du système ne sait pas gérer.
  if (depth > 0) {
    depth += 1;
    try {
      return body(makeContext());
    } finally {
      depth -= 1;
    }
  }

  const effects = [];
  pendingEffects = effects;
  depth = 1;

  let result;
  try {
    result = db.transaction(() => body(makeContext()))();
  } catch (err) {
    // Transaction annulée : les effets collectés sont jetés sans être émis.
    pendingEffects = [];
    depth = 0;
    throw err;
  }

  pendingEffects = [];
  depth = 0;

  flushEffects(effects);
  return result;
}

/** Une transaction est-elle ouverte ? Utilisé par les tests structurels de la Loi 7. */
function inTransaction() {
  return depth > 0 || db.inTransaction;
}

module.exports = { run, inTransaction };
