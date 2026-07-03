const db = require('../db');

function createMerchantNotification(merchantId, title, body, type = 'system') {
  db.prepare(`
    INSERT INTO merchant_notifications (id, user_id, title, body, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(db.generateId(), merchantId, title, body, type);
}

module.exports = { createMerchantNotification };
