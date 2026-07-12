const db = require('../db');

function getLastReadAt(conversationId, userId) {
  const row = db
    .prepare('SELECT last_read_at FROM conversation_reads WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId);
  return row?.last_read_at || null;
}

function countUnread(conversationId, userId) {
  const lastRead = getLastReadAt(conversationId, userId);
  if (!lastRead) {
    return db
      .prepare(
        `SELECT COUNT(*) as c FROM messages
         WHERE conversation_id = ? AND sender_id != ?`
      )
      .get(conversationId, userId).c;
  }
  return db
    .prepare(
      `SELECT COUNT(*) as c FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND created_at > ?`
    )
    .get(conversationId, userId, lastRead).c;
}

function markRead(conversationId, userId) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT(conversation_id, user_id) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(conversationId, userId, now);
  return now;
}

module.exports = { getLastReadAt, countUnread, markRead };
