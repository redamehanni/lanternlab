/**
 * Organe Orders — journal append-only des décisions de commande.
 *
 * LOI 9 : ce qui n'est pas journalisé n'est pas arrivé. Écrit dans la MÊME
 * transaction que la décision, via le noyau. Répond à la question qu'aucun support
 * client ne pouvait trancher jusqu'ici : « que s'est-il passé sur cette commande,
 * dans quel ordre, et à cause de qui ».
 */

const { journal } = require('../kernel');

const ORDER_JOURNAL_TYPE = {
  CREATED: 'created',
  TRANSITIONED: 'transitioned',
  CANCELLED: 'cancelled',
  STOCK_CONSUMED: 'stock_consumed',
  STOCK_RESTORED: 'stock_restored',
  STOCK_COMMITTED: 'stock_committed',
};

const orderJournal = journal.defineJournal({
  name: 'orders',
  table: 'order_journal',
  subjectColumn: 'order_id',
  subjectReferences: 'orders(id)',
});

module.exports = { orderJournal, ORDER_JOURNAL_TYPE };
