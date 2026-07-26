const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { assignPendingOrdersToDriver } = require('../lib/dispatch');
const { canViewOrder, canAccessConversation } = require('../lib/access');

module.exports = function setupSocket(io) {
  // Authentification de chaque connexion socket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const { id, name, role } = socket.user;
    console.log(`[Socket] ${name} (${role}) connecté — socket ${socket.id}`);

    // Chaque utilisateur rejoint sa room personnelle
    socket.join(`user_${id}`);

    // Les commerçants rejoignent leur room pour recevoir les commandes
    if (role === 'merchant') {
      socket.join(`merchant_${id}`);
      const memberships = db.prepare('SELECT store_id FROM store_members WHERE user_id = ?').all(id);
      for (const m of memberships) {
        socket.join(`store_${m.store_id}`);
      }
    }

    // Les livreurs rejoignent la room uniquement s'ils sont en ligne
    if (role === 'driver') {
      const row = db.prepare('SELECT driver_online FROM users WHERE id = ?').get(id);
      if (row?.driver_online) {
        socket.join('drivers_available');
        console.log(`[Socket] Livreur ${name} disponible pour missions`);
      } else {
        console.log(`[Socket] Livreur ${name} connecté (hors ligne)`);
      }
    }

    // ── Événements émis par le client mobile ──────────────────────────────

    // Rejoindre la room d'une commande (client/livreur/commerçant pendant le suivi).
    // Une room de commande diffuse la position du livreur et l'adresse de
    // livraison : y entrer sans être partie prenante est une fuite de données.
    socket.on('join:order', (orderId, ack) => {
      if (!canViewOrder(socket.user, orderId)) {
        console.warn(`[Socket] ${name} refusé sur order_${orderId}`);
        if (typeof ack === 'function') ack({ ok: false, error: 'Accès refusé' });
        return;
      }
      socket.join(`order_${orderId}`);
      if (typeof ack === 'function') ack({ ok: true });
      console.log(`[Socket] ${name} a rejoint order_${orderId}`);
    });

    socket.on('leave:order', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Rejoindre / quitter la room d'UNE conversation précise (messagerie séparée)
    socket.on('join:conversation', (conversationId, ack) => {
      if (!canAccessConversation(socket.user, conversationId)) {
        console.warn(`[Socket] ${name} refusé sur conv_${conversationId}`);
        if (typeof ack === 'function') ack({ ok: false, error: 'Accès refusé' });
        return;
      }
      socket.join(`conv_${conversationId}`);
      if (typeof ack === 'function') ack({ ok: true });
    });
    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
    });

    // Livreur se déclare disponible
    socket.on('driver:online', () => {
      if (role !== 'driver') return;
      db.prepare('UPDATE users SET driver_online = 1 WHERE id = ?').run(id);
      socket.join('drivers_available');
      assignPendingOrdersToDriver(id, io);
      console.log(`[Socket] Livreur ${name} est EN LIGNE`);
    });

    // Livreur se déclare indisponible
    socket.on('driver:offline', () => {
      if (role !== 'driver') return;
      db.prepare('UPDATE users SET driver_online = 0 WHERE id = ?').run(id);
      socket.leave('drivers_available');
      console.log(`[Socket] Livreur ${name} est HORS LIGNE`);
    });

    // Indicateur de saisie dans le chat (par conversation).
    // `socket.to()` diffuse dans une room même si l'émetteur n'y est pas : sans ce
    // contrôle, n'importe qui pourrait se faire passer pour un participant.
    socket.on('chat:typing', ({ conversationId } = {}) => {
      if (!conversationId) return;
      if (!canAccessConversation(socket.user, conversationId)) return;
      socket.to(`conv_${conversationId}`).emit('chat:typing', { userId: id, name });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${name} (${role}) déconnecté`);
    });
  });
};
