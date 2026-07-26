/**
 * Organe Inventory — façade.
 *
 * Les autres organes n'importent que ce fichier. `stockLevels` et `movements`
 * restent internes : ils écrivent, et laisser une route les atteindre ouvrirait un
 * chemin d'écriture qui contourne le journal et la projection.
 */

const engine = require('./inventoryEngine');
const levels = require('./stockLevels');
const migrate = require('./migrate');
const policy = require('./policy');

module.exports = {
  // Opérations
  reserve: engine.reserve,
  release: engine.release,
  commit: engine.commit,
  adjust: engine.adjust,
  syncOnHand: engine.syncOnHand,
  declareSellable: engine.declareSellable,

  // Lectures
  getSellableQty: engine.getSellableQty,
  getLevel: engine.getLevel,
  recomputeAvailable: engine.recomputeAvailable,
  readMovements: engine.readMovements,
  reservedFor: engine.reservedFor,
  listForStore: levels.listForStore,

  // Politique commerciale
  setSafetyBuffer: levels.setSafetyBuffer,
  setInventoryOwner: levels.setInventoryOwner,
  ensureLevel: levels.ensure,

  // Reprise et intégrité
  backfill: migrate.backfill,
  findProjectionDrift: migrate.findProjectionDrift,
  repairProjectionDrift: migrate.repairProjectionDrift,

  // Vocabulaire
  INVENTORY_OWNER: policy.INVENTORY_OWNER,
  MOVEMENT_KIND: policy.MOVEMENT_KIND,
  MOVEMENT_ORIGIN: policy.MOVEMENT_ORIGIN,
  InventoryError: policy.InventoryError,
  InsufficientStockError: policy.InsufficientStockError,
  computeAvailable: policy.computeAvailable,
};
