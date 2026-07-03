/** Statuts commande — version stable simple */

const ORDER_STATUS = {
  PLACED: 'placed',
  PENDING_DRIVER: 'pending_driver',
  DRIVER_ASSIGNED: 'driver_assigned',
  PICKING_UP: 'picking_up',
  PICKED_UP: 'picked_up',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const LEGACY_STATUS_MAP = {
  pending: ORDER_STATUS.PENDING_DRIVER,
  searching_driver: ORDER_STATUS.PENDING_DRIVER,
  offered: ORDER_STATUS.PENDING_DRIVER,
  accepted: ORDER_STATUS.DRIVER_ASSIGNED,
  accepted_by_driver: ORDER_STATUS.DRIVER_ASSIGNED,
};

function normalizeOrderStatus(status) {
  return LEGACY_STATUS_MAP[status] || status;
}

const CANCELLABLE_STATUSES = new Set([
  ORDER_STATUS.PLACED,
  ORDER_STATUS.PENDING_DRIVER,
  ORDER_STATUS.DRIVER_ASSIGNED,
  ORDER_STATUS.PICKING_UP,
  'pending',
  'searching_driver',
  'offered',
  'accepted',
  'accepted_by_driver',
]);

function canClientCancel(status) {
  const s = normalizeOrderStatus(status);
  return CANCELLABLE_STATUSES.has(s);
}

function isTerminalStatus(status) {
  const s = normalizeOrderStatus(status);
  return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.CANCELLED;
}

module.exports = {
  ORDER_STATUS,
  normalizeOrderStatus,
  canClientCancel,
  isTerminalStatus,
};
