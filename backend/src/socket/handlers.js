const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { assignPendingOrdersToDriver } = require('../lib/dispatch');

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

    // Rejoindre la room d'une commande (client/livreur/commerçant pendant le suivi)
    socket.on('join:order', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`[Socket] ${name} a rejoint order_${orderId}`);
    });

    socket.on('leave:order', (orderId) => {
      socket.leave(`order_${orderId}`);
    });

    // Rejoindre / quitter la room d'UNE conversation précise (messagerie séparée)
    socket.on('join:conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
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

    // Indicateur de saisie dans le chat (par conversation)
    socket.on('chat:typing', ({ conversationId }) => {
      if (conversationId) socket.to(`conv_${conversationId}`).emit('chat:typing', { userId: id, name });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${name} (${role}) déconnecté`);
    });
  });
};
