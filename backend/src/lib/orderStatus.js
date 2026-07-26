/**
 * Compatibilité — le vocabulaire des statuts vit désormais dans l'organe Orders.
 *
 * Ce fichier ne contient plus aucune règle : il réexporte
 * `lib/orders/lifecycle.js` pour que les appelants historiques
 * (`routes/missions.js`, `lib/dispatch.js`, tests) continuent de fonctionner sans
 * modification. Une seule source de vérité, deux portes d'entrée.
 *
 * @deprecated Importer `lib/orders/lifecycle` dans tout nouveau code.
 */

const lifecycle = require('./orders/lifecycle');

module.exports = {
  ORDER_STATUS: lifecycle.ORDER_STATUS,
  LEGACY_STATUS_MAP: lifecycle.LEGACY_STATUS_MAP,
  normalizeOrderStatus: lifecycle.normalizeOrderStatus,
  canClientCancel: lifecycle.canClientCancel,
  isTerminalStatus: lifecycle.isTerminalStatus,
};
