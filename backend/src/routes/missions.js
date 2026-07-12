const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { archiveEphemeralForOrder } = require('../lib/communicationEngine');
const { listAvailableMissions, missionToBroadcast } = require('../lib/missions');
const { ORDER_STATUS } = require('../lib/orderStatus');
const { getFullMission, assignPendingOrdersToDriver, assignOrderToDriver, tryDispatchNewOrder } = require('../lib/dispatch');
const { clearOfferTimeout, getOfferedMissionForDriver } = require('../lib/dispatchOffer');

const router = express.Router();

// GET /api/missions/stats
router.get('/stats', verifyToken, requireRole('driver'), (req, res) => {
  const COMMISSION = 0.05;

  const completed = db.prepare(`
    SELECT m.*, o.total_price, o.created_at as order_created_at,
      p.name as product_name, s.name as store_name
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    WHERE m.driver_id = ? AND m.status = 'delivered'
    ORDER BY m.updated_at DESC
  `).all(req.user.id);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - ((now.getDay() + 6) % 7) * 86400000;

  let earningsToday = 0, earningsWeek = 0, earningsTotal = 0;
  let deliveriesToday = 0;

  const history = completed.map((m) => {
    const gain = Math.round(m.total_price * COMMISSION * 100) / 100;
    const t = new Date((m.updated_at || m.accepted_at || m.order_created_at) + 'Z').getTime();
    earningsTotal += gain;
    if (t >= startOfWeek) earningsWeek += gain;
    if (t >= startOfDay) { earningsToday += gain; deliveriesToday += 1; }
    return {
      id: m.id,
      product_name: m.product_name,
      store_name: m.store_name,
      total_price: m.total_price,
      gain,
      date: m.updated_at || m.accepted_at,
    };
  });

  const deliveries = completed.length;
  const rating = deliveries === 0 ? null : Math.min(5, 4.6 + Math.min(0.4, deliveries * 0.02));

  res.json({
    stats: {
      earnings_today: Math.round(earningsToday * 100) / 100,
      earnings_week: Math.round(earningsWeek * 100) / 100,
      earnings_total: Math.round(earningsTotal * 100) / 100,
      deliveries_total: deliveries,
      deliveries_today: deliveriesToday,
      rating: rating ? Math.round(rating * 10) / 10 : null,
    },
    history,
  });
});

router.get('/offered', verifyToken, requireRole('driver'), (req, res) => {
  const data = getOfferedMissionForDriver(req.user.id);
  if (!data) return res.json({ mission: null, offer: null });
  res.json(data);
});

router.get('/available', verifyToken, requireRole('driver'), (req, res) => {
  const missions = listAvailableMissions(20);
  res.json({ missions, pending: missions.map(missionToBroadcast) });
});

router.get('/mine', verifyToken, requireRole('driver'), (req, res) => {
  const missions = db.prepare(`
    SELECT m.*,
      p.name as product_name, p.image_url as product_image,
      s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng,
      s.merchant_id,
      c.name as client_name, c.phone as client_phone,
      o.delivery_address, o.total_price, o.estimated_minutes
    FROM missions m
    JOIN orders o ON m.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    JOIN users c ON o.client_id = c.id
    WHERE m.driver_id = ?
    ORDER BY m.accepted_at DESC
    LIMIT 30
  `).all(req.user.id);

  const active = missions.find(m => ['accepted', 'picking_up', 'picked_up', 'delivering'].includes(m.status)) || null;
  res.json({ missions, active });
});

router.post('/:id/accept', verifyToken, requireRole('driver'), (req, res) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable' });

  const io = req.app.get('io');

  if (mission.status === 'offered') {
    if (mission.offered_to_driver_id && mission.offered_to_driver_id !== req.user.id) {
      return res.status(409).json({ error: 'Offre expirée ou destinée à un autre livreur' });
    }
    clearOfferTimeout(mission.id);
    const result = assignOrderToDriver(mission.order_id, req.user.id, io);
    if (!result) return res.status(409).json({ error: 'Mission déjà prise ou expirée' });
    return res.json(result);
  }

  if (mission.status !== 'available') {
    return res.status(409).json({ error: 'Mission déjà prise ou expirée' });
  }

  const result = assignOrderToDriver(mission.order_id, req.user.id, io);
  if (!result) return res.status(409).json({ error: 'Mission déjà prise ou expirée' });
  res.json(result);
});

router.post('/:id/refuse', verifyToken, requireRole('driver'), (req, res) => {
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable' });

  const io = req.app.get('io');

  if (mission.status === 'offered' && mission.offered_to_driver_id === req.user.id) {
    clearOfferTimeout(mission.id);
    db.prepare(`
      UPDATE missions
      SET status = 'available', offered_to_driver_id = NULL, offer_expires_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(mission.id);
    tryDispatchNewOrder(mission.order_id, io, { excludeDriverIds: [req.user.id] });
    return res.json({ refused: true });
  }

  if (mission.status !== 'available') {
    return res.status(409).json({ error: 'Mission non disponible' });
  }
  res.json({ refused: true });
});

router.patch('/:id/status', verifyToken, requireRole('driver'), (req, res) => {
  const { status } = req.body;
  const valid = ['picking_up', 'picked_up', 'delivering', 'delivered'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  const mission = db.prepare('SELECT * FROM missions WHERE id = ? AND driver_id = ?').get(req.params.id, req.user.id);
  if (!mission) return res.status(404).json({ error: 'Mission introuvable' });

  db.prepare("UPDATE missions SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, mission.id);

  const orderStatusMap = {
    picking_up: ORDER_STATUS.PICKING_UP,
    picked_up: ORDER_STATUS.PICKED_UP,
    delivering: ORDER_STATUS.DELIVERING,
    delivered: ORDER_STATUS.DELIVERED,
  };
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(orderStatusMap[status], mission.order_id);

  const full = getFullMission(mission.id);
  const io = req.app.get('io');

  io.to(`order_${mission.order_id}`).emit('mission:status_updated', { mission: full, status });
  io.to(`merchant_${full.merchant_id}`).emit('mission:status_updated', { mission: full, status });
  io.to(`user_${req.user.id}`).emit('mission:status_updated', { mission: full, status });

  if (status === 'delivered') {
    archiveEphemeralForOrder(mission.order_id);
    assignPendingOrdersToDriver(req.user.id, io);
  }

  res.json({ mission: full });
});

module.exports = router;
