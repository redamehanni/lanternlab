const db = require('../db');

const AVAILABLE_MISSIONS_SQL = `
  SELECT m.*,
    p.name as product_name, p.image_url as product_image, p.price as product_price,
    s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng,
    c.name as client_name, c.phone as client_phone,
    o.delivery_address, o.total_price, o.quantity as order_quantity, o.estimated_minutes
  FROM missions m
  JOIN orders o ON m.order_id = o.id
  JOIN products p ON o.product_id = p.id
  JOIN stores s ON o.store_id = s.id
  JOIN users c ON o.client_id = c.id
    WHERE m.status = 'available'
    AND m.driver_id IS NULL
    AND o.status IN ('pending_driver', 'placed', 'pending', 'searching_driver')
    AND o.status NOT IN ('delivered', 'cancelled')
  ORDER BY o.created_at ASC
`;

function missionToBroadcast(row) {
  const commission = Math.round((row.total_price || 0) * 0.05 * 100) / 100;
  return {
    mission: {
      id: row.id,
      order_id: row.order_id,
      driver_id: row.driver_id ?? null,
      status: row.status,
      accepted_at: row.accepted_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    order: {
      id: row.order_id,
      product_name: row.product_name,
      product_image: row.product_image,
      product_price: row.product_price,
      store_name: row.store_name,
      store_address: row.store_address,
      store_lat: row.store_lat,
      store_lng: row.store_lng,
      client_name: row.client_name,
      client_phone: row.client_phone,
      delivery_address: row.delivery_address,
      total_price: row.total_price,
      commission,
      estimated_minutes: row.estimated_minutes,
    },
  };
}

function listAvailableMissions(limit = 20) {
  return db.prepare(`${AVAILABLE_MISSIONS_SQL} LIMIT ?`).all(limit);
}

function listPendingBroadcasts(limit = 20) {
  return listAvailableMissions(limit).map(missionToBroadcast);
}

module.exports = {
  AVAILABLE_MISSIONS_SQL,
  missionToBroadcast,
  listAvailableMissions,
  listPendingBroadcasts,
};
