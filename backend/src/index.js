require('./db'); // Initialise le schéma SQLite au démarrage

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const storesRoutes = require('./routes/stores');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const missionsRoutes = require('./routes/missions');
const messagesRoutes = require('./routes/messages');
const conversationsRoutes = require('./routes/conversations');
const usersRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const favoritesRoutes = require('./routes/favorites');
const promotionsRoutes = require('./routes/promotions');
const driversRoutes = require('./routes/drivers');
const merchantsRoutes = require('./routes/merchants');
const setupSocket = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

// ── Configuration ────────────────────────────────────────────────────────────

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les images uploadées
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Socket.io ────────────────────────────────────────────────────────────────

const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
  transports: ['websocket', 'polling'],
});

// Rendre io accessible dans toutes les routes via req.app.get('io')
app.set('io', io);
setupSocket(io);

// ── Routes HTTP ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/merchants', merchantsRoutes);

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Page d'accueil (évite "Cannot GET /" dans le navigateur)
app.get('/', (req, res) => {
  res.json({
    name: 'Ma Zone API',
    status: 'running',
    message: 'Le backend fonctionne. L\'application mobile se lance via Expo (port 8081), pas ici.',
    health: '/health',
    docs: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      promotions: '/api/promotions',
    },
    mobile: 'cd mobile && npm run ios',
  });
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
// MODE TEST MAC UNIQUEMENT  → décommenter cette ligne (téléphones ne peuvent pas accéder)
// server.listen(PORT, '127.0.0.1', () => {

// MODE MULTI-APPAREILS (Mac + téléphones sur le même Wi-Fi) → décommenter cette ligne
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║         MA ZONE — Backend API         ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log(`║  URL : http://localhost:${PORT}            ║`);
  console.log('║                                       ║');
  console.log('║  Lancez l\'app : cd mobile && npm run ios');
  console.log('╚═══════════════════════════════════════╝\n');
});
