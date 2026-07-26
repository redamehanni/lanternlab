/**
 * Noyau Ma Zone — les quatre primitives dont tous les organes ont besoin.
 *
 * Étape 2 de ROADMAP_ORGANE_ORCHESTRATION_MAZONE.md. Rien d'inventé ici : bus,
 * journal et idempotence étaient déjà implémentés trois fois chacun dans le code
 * (Event, Wallet, Identity). Ils sont extraits AVANT d'être dupliqués une sixième
 * fois par Orders et Inventory.
 *
 *   bus          Transporte des faits déjà arrivés. Ne décide rien (Loi 8).
 *   journal      Écrit et relit l'historique. N'interprète rien (Loi 9).
 *   idempotency  Répond « déjà fait, voici le résultat ». Ne connaît aucun métier (Loi 10).
 *   txn          Garantit l'ordre commit → effets. Seul autorisé à retenir une émission (Loi 7).
 *
 * Ce que le noyau ne fait PAS : aucune règle métier, aucune connaissance d'un
 * logiciel tiers, aucune décision. Un noyau qui décide n'est plus un noyau.
 */

const bus = require('./bus');
const journal = require('./journal');
const idempotency = require('./idempotency');
const txn = require('./txn');

module.exports = { bus, journal, idempotency, txn };
