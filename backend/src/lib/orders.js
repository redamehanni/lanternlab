const db = require('../db');

function getFullOrder(orderId) {
  return db.prepare(`
    SELECT o.*,
      u.name as client_name, u.phone as client_phone, u.address as client_address,
      u.lat as client_lat, u.lng as client_lng,
      p.name as product_name, p.image_url as product_image, p.description as product_description,
      s.name as store_name, s.address as store_address, s.lat as store_lat, s.lng as store_lng,
      s.merchant_id as merchant_id,
      m.id as mission_id, m.status as mission_status, m.driver_id,
      d.name as driver_name, d.phone as driver_phone
    FROM orders o
    JOIN users u ON o.client_id = u.id
    JOIN products p ON o.product_id = p.id
    JOIN stores s ON o.store_id = s.id
    LEFT JOIN missions m ON m.order_id = o.id
    LEFT JOIN users d ON m.driver_id = d.id
    WHERE o.id = ?
  `).get(orderId);
}

module.exports = { getFullOrder };
