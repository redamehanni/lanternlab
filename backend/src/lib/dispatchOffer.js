const db = require('../db');
const { OFFER_DURATION_SEC, BASE_EARNINGS, BONUS_RATE } = require('../config/dispatch');
const { getFullMission, driverIsBusyForNewOffer } = require('./dispatch');

const pendingTimeouts = new Map();

function clearOfferTimeout(missionId) {
  const t = pendingTimeouts.get(missionId);
  if (t) {
    clearTimeout(t);
    pendingTimeouts.delete(missionId);
  }
}

function computeOffer(totalPrice) {
  const bonus = Math.round(totalPrice * BONUS_RATE * 100) / 100;
  const earnings = Math.round((BASE_EARNINGS + bonus) * 100) / 100;
  return { base: BASE_EARNINGS, bonus, earnings };
}

function buildOfferPayload(missionRow) {
  const { earnings, base, bonus } = computeOffer(missionRow.total_price || 0);
  return {
    store_name: missionRow.store_name,
    store_address: missionRow.store_address,
    earnings,
    base,
    bonus,
    expires_at: missionRow.offer_expires_at,
    estimated_minutes: missionRow.estimated_minutes,
  };
}

function expireOffer(missionId, driverId, io) {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(missionId);
  if (!mission || mission.status !== 'offered' || mission.offered_to_driver_id !== driverId) return;

  db.prepare(`
    UPDATE missions
    SET status = 'available', offered_to_driver_id = NULL, offer_expires_at = NULL, updated_at = datetime('now')
    WHERE id = ? AND status = 'offered' AND offered_to_driver_id = ?
  `).run(missionId, driverId);

  const { tryDispatchNewOrder } = require('./dispatch');
  tryDispatchNewOrder(mission.order_id, io, { excludeDriverIds: [driverId] });
}

function proposeOrderToDriver(orderId, driverId, io) {
  const row = db.prepare(`
    SELECT o.id, o.total_price, o.estimated_minutes, m.id as mission_id,
      s.name as store_name, s.address as store_address
    FROM orders o
    JOIN missions m ON m.order_id = o.id
    JOIN stores s ON o.store_id = s.id
    WHERE o.id = ?
      AND m.driver_id IS NULL
      AND m.status = 'available'
  `).get(orderId);

  if (!row) return null;
  if (driverIsBusyForNewOffer(driverId)) return null;

  db.prepare(`
    UPDATE missions
    SET status = 'offered',
        offered_to_driver_id = ?,
        offer_expires_at = datetime('now', '+${OFFER_DURATION_SEC} seconds'),
        updated_at = datetime('now')
    WHERE id = ? AND driver_id IS NULL AND status = 'available'
  `).run(driverId, row.mission_id);

  const full = getFullMission(row.mission_id);
  const missionRow = db.prepare(`
    SELECT m.*, o.total_price, o.estimated_minutes, s.name as store_name, s.address as store_address
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN stores s ON o.store_id = s.id
    WHERE m.id = ?
  `).get(row.mission_id);

  const offer = buildOfferPayload(missionRow);

  if (io) {
    console.log(`[Dispatch] mission:offered → driver ${driverId} order ${orderId}`);
    io.to(`user_${driverId}`).emit('mission:offered', { mission: full, offer });
  }

  clearOfferTimeout(row.mission_id);
  const timeout = setTimeout(() => {
    pendingTimeouts.delete(row.mission_id);
    expireOffer(row.mission_id, driverId, io);
  }, OFFER_DURATION_SEC * 1000);
  pendingTimeouts.set(row.mission_id, timeout);

  return { mission: full, offer };
}

function getOfferedMissionForDriver(driverId) {
  const row = db.prepare(`
    SELECT m.*, o.total_price, o.estimated_minutes, s.name as store_name, s.address as store_address
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN stores s ON o.store_id = s.id
    WHERE m.offered_to_driver_id = ?
      AND m.status = 'offered'
      AND datetime(m.offer_expires_at) > datetime('now')
    ORDER BY m.updated_at DESC
    LIMIT 1
  `).get(driverId);

  if (!row) return null;
  return {
    mission: getFullMission(row.id),
    offer: buildOfferPayload(row),
  };
}

module.exports = {
  proposeOrderToDriver,
  expireOffer,
  clearOfferTimeout,
  getOfferedMissionForDriver,
  buildOfferPayload,
  computeOffer,
};
